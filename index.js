import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import env from "dotenv";
import multer from "multer";
const app=express();
const testPassword = 'userpassword';
const port=process.env.PORT||3000;
const saltRounds = 10;
env.config();
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());
const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();
const upload = multer({ storage: multer.memoryStorage() });
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.get("/",async(req,res)=>{
  const Bdata=await db.query("SELECT * FROM blog");
  if(req.isAuthenticated()){
    res.render("index.ejs",{user:true,name:req.user.name,data:Bdata.rows});
  }else{
  res.render("index.ejs",{user:false,name:"",data:Bdata.rows});
  }
})
app.get("/login",(req,res)=>{
    res.render("login.ejs");
})
app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});
app.get("/signup",(req,res)=>{
    res.render("signup.ejs");
})
app.get("/image/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query("SELECT image FROM blog WHERE id = $1", [id]);

    if (result.rows.length > 0) {
      const imageBuffer = result.rows[0].image; 
      res.setHeader("Content-Type", "image/"); 
      res.send(imageBuffer); 
    } else {
      res.status(404).send("Image not found");
    }
  } catch (err) {
    console.error("Error fetching image:", err);
    res.status(500).send("Error fetching image");
  }
});
app.get("/create",(req,res)=>{
  if(req.isAuthenticated()){
    res.render("create.ejs");
  }
  else{
    res.redirect("/");
  }
})
app.get("/myBlog",async(req,res)=>{
  if(req.isAuthenticated()){
    const userData=await db.query("select * from blog where author=$1",[req.user.name]);
    res.render("my-blogs.ejs",{name:req.user.name,data:userData.rows});
  }
  else{
    res.redirect("/login");
  }
})
app.post("/delete",async(req,res)=>{
  await db.query("DELETE FROM blog WHERE title = $1", [req.body.blogTitle]);
  res.redirect("/myBlog")
})
app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/google/blog",
  passport.authenticate("google", {
    successRedirect: "/",
    failureRedirect: "/login",
  })
);
app.post("/register",async(req,res)=>{
  const email = req.body.email;
  const password = req.body.password;
  const name= req.body.name;
    try {
      const checkResult = await db.query("SELECT * FROM user_info WHERE email = $1", [
        email,
      ]);
      if (checkResult.rows.length > 0) {
        res.redirect("/login");
      } else {
        bcrypt.hash(password, saltRounds, async (err, hash) => {
          if (err) {
            console.error("Error hashing password:", err);
          } else {
            const result = await db.query(
              "INSERT INTO user_info (name,email,user_password) VALUES ($1, $2,$3) RETURNING *",
              [name,email, hash]
            );
            const user = result.rows[0];
            req.login(user, (err) => {
              console.log("success");
            });
            res.redirect("/");
          }
        });
      }
    } catch (err) {
      console.log(err);
    }
})


app.post("/log",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
  })
);
app.post("/upload",upload.single("blog-img"),async(req,res)=>{
  if(req.isAuthenticated()){
  try {
    await db.query('INSERT INTO blog (title, content,author,image) VALUES ($1, $2,$3,$4)', [req.body.title,req.body.content,req.user.name,req.file.buffer]);
    res.redirect("/");
} catch (err) {
    console.error('Error uploading image:', err);
    res.status(500)
}}
})
app.post("/blog",async(req,res)=>{
  const title=req.body.blogTitle
  const data={
    tit:title,
    img:'',
    para:'',
    author:''
  }
  const blogCONT=await db.query("SELECT * FROM blog");
  const blogCONTENT=blogCONT.rows;
 blogCONTENT.forEach((element)=> {
  if(element.title===title){
    data.tit=element.title;
    data.img=element.id,
    data.para=element.content
    data.author=element.author;
  }
 });
  res.render("blog.ejs",{bdata:data});
})

passport.use(
  "local",
  new Strategy({ usernameField: "email" },async function verify(email, password, cb){
    try {
      const result = await db.query("SELECT * FROM user_info WHERE email = $1 ", [email,]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.user_password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              return cb(null, user);
            } else {
              return cb(null, false);
            }
          }
        });
      } else {
        return cb("User not found");
      }
    } catch (err) {
      console.log(err);
    }
  })
);
passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/blog",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        const result = await db.query("SELECT * FROM user_info WHERE email = $1", [
          profile.email,
        ]);
        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO user_info (name,email, user_password) VALUES ($1, $2)",
            [profile.name,profile.email, "google"]
          );
          return cb(null, newUser.rows[0]);
        } else {
          return cb(null, result.rows[0]);
        }
      } catch (err) {
        return cb(err);
      }
    }
  )
);
passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});
app.listen(port,()=>{
    console.log("server is running");
})