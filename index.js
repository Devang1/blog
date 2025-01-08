import express from "express"
import bodyParser from "body-parser";
import fs, { readFile } from "fs";
import {readFile as read} from "fs/promises"
import path from "path";
import multer from "multer";
const app=express();
const port=3000;
let userlogged=false;
let username;
let userpass;
const filePath=path.join("data","links.json");
const blogPath=path.join("data","blog.json");
app.use(bodyParser.urlencoded({ extended: true }));
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/uploads')
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`)
  }
})
const CheckFunc =(req,res,next)=>{
  if(!userlogged){
    res.redirect("/login");
  }
  next();
}
const upload = multer({ storage: storage })
app.use(express.static("public"));
app.get("/",async(req,res)=>{
  const blog= await read(blogPath, 'utf8',async(err, data) => {
    if (err) {
      console.error("Error reading the file:", err);
      return res.status(500).send("Internal Server Error");
    }
      const jsonData = JSON.parse(data);
      return jsonData;
  });
 const blogCONTENT=JSON.parse(blog);
  res.render("index.ejs",{user:userlogged,name:username,data:blogCONTENT});
})
app.get("/login",(req,res)=>{
    res.render("login.ejs");
})
app.get("/signup",(req,res)=>{
    res.render("signup.ejs");
})
app.get("/create",CheckFunc,(req,res)=>{
  res.render("create.ejs");
})
app.post("/register",(req,res)=>{
 username=req.body["name"];
 userpass=req.body["password"];
 const newuser={"name":username,"pass":userpass};
 fs.readFile(filePath, 'utf8',async(err, data) => {
  if (err) {
    console.error("Error reading the file:", err);
    return res.status(500).send("Internal Server Error");
  }

  try {
    const jsonData = JSON.parse(data);

    if (!Array.isArray(jsonData)) {
      return res.status(400).send("JSON file does not contain an array.");
    }
    let flag=false;

    // Add new data to the array
    for (const key in jsonData) {
      if(jsonData[key].name===newuser.name){
        flag=true;
      }
    }
    if(flag===false){
      jsonData.push(newuser);
      username=newuser.name;
      res.redirect("/");
    }else{
      res.send(` <script>alert("username already exists");window.location.href = '/signup'; // Redirect to another page after alert </script>`);
    }
    
    // Write the updated data back to the file
    fs.writeFile(filePath, JSON.stringify(jsonData), (writeErr) => {
      if (writeErr) {
        console.error("Error writing to the file:", writeErr);
      }
    });
  } catch (parseErr) {
    console.error("Error parsing JSON data:", parseErr);
  }
});

userlogged=true;
})


app.post("/log",(req,res)=>{
    username =req.body["name"];
    userpass=req.body["password"];
    const newuser={"name":username,"pass":userpass};
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.error("Error reading the file:", err);
      }
  
      try {
        const jsonData = JSON.parse(data);
        let flag=false;
        // Check if jsonData is an array before calling forEach
        if (Array.isArray(jsonData)) {
          // return jsonData;
          jsonData.forEach(element => {
            if(newuser.name===element.name &&newuser.pass===element.pass){
              flag=true;
            }
          });
        } else {
          console.error("JSON data is not an array!");
        }
        if(flag===true){
          username=newuser.name;
          userlogged=true;
          res.redirect("/");
        }
        else{
          res.send(` <script>alert("username or password is wrong");window.location.href = '/login'; // Redirect to another page after alert </script>`);
        }
      } catch (parseErr) {
        console.error("Error parsing JSON data:", parseErr);
      }
    });
})
app.post("/upload",upload.single("blog-img"),(req,res)=>{
  const blogdata={
    title: req.body.title,
    content: req.body.content,
    path: req.file.filename
  };
  fs.readFile(blogPath, 'utf8',async(err, data) => {
    if (err) {
      console.error("Error reading the file:", err);
      return res.status(500).send("Internal Server Error");
    }
    try {
      const jsonData = JSON.parse(data);
      // Add new data to the array
        jsonData.push(blogdata);
      // Write the updated data back to the file
      fs.writeFile(blogPath, JSON.stringify(jsonData), (writeErr) => {
        if (writeErr) {
          console.error("Error writing to the file:", writeErr);
        }
      });
    } catch (parseErr) {
      console.error("Error parsing JSON data:", parseErr);
    }
  });
  res.redirect("/");
})
app.post("/blog",async(req,res)=>{
  const title=req.body.blogTitle
  const data={
    tit:title,
    img:'',
    para:''
  }
  const blog= await read(blogPath, 'utf8',async(err, data) => {
    if (err) {
      console.error("Error reading the file:", err);
      return res.status(500).send("Internal Server Error");
    }
      const jsonData = JSON.parse(data);
      return jsonData;
  });
 const blogCONTENT=JSON.parse(blog);
 blogCONTENT.forEach((element)=> {
  if(element.title===title){
    data.tit=element.title;
    data.img=`uploads/${element.path}`,
    data.para=element.content
  }
 });
  res.render("blog.ejs",{bdata:data});
})
app.listen(3000,()=>{
    console.log("server is running");
})