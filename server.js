const express=require('express')
const app=express()
const ejs=require('ejs')
const bodyparser=require('body-parser')
const nodemailer=require('nodemailer')
const mongoose=require('mongoose')
const multer=require('multer')
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const session=require('express-session')
const { MongoNetworkError } = require('mongodb')
const { defaultMaxListeners } = require('nodemailer/lib/xoauth2')
const MongoDBStore = require('connect-mongodb-session')(session);
require('dotenv').config()

app.set('view engine','ejs')
app.use(express.json())
app.use(bodyparser.urlencoded({extended: false}))
app.use(express.static('views'));

//sessions store
const store = new MongoDBStore({
    uri: 'mongodb+srv://helloadimin:iamadmin@cluster0.vhj12nj.mongodb.net/Hostel_db',
    collection: 'mySessions'
  });
  app.use(session({
      secret: 'your secret',
      resave: true,
      saveUninitialized: false,
      store: store
    }));

  //authenticate sessions
  function isAuthenticated(req, res, next) {
    if (req.session.user) {
      return next();
    }
    res.redirect('/login');
  }

  //mongoose connection
  mongoose
  .connect(process.env.MONGO_URL,{
    useNewUrlParser : true
  }).then(() => console.log("Database connected!"))
  .catch(err => console.log(err));

//object schemas
const admin_schema=mongoose.Schema({
   username: String,
   password:String,
   Designation:String,
   Hostel:String,
   phone:String
})

const student_schema=mongoose.Schema({
  username:String,
  password:String,
  year:String,
  Branch:String,
  Room_no:String,
  Fullname:String,
  phone:String,
  Hostel:String
})

const complaint_schema=mongoose.Schema({
  user_id:mongoose.Schema.Types.ObjectId,
  room_num:String,
  complaint:String,
  date:Date,
})

const mess_schema=mongoose.Schema({
  day:String,
  breakfast:String,
  Lunch:String,
  Dinner:String
})

const notice_schema=mongoose.Schema({
  contentType: String,
  data: String
})

const payment_schema=mongoose.Schema({
   user_id:mongoose.Schema.Types.ObjectId,
   amount:String,
   Fullname:String,
   phone:String,
   Hostel:String,
   year:String,
   Branch:String
})

const resolved_schema=mongoose.Schema({
  user_id:mongoose.Schema.Types.ObjectId,
  admin_id:mongoose.Schema.Types.ObjectId,
  text:String,
  Room:String
})

//creating models
const Student=mongoose.model('Student',student_schema)
const Admin=mongoose.model('Admin',admin_schema)
const Complaints=mongoose.model('Complaints',complaint_schema)
const Mess =mongoose.model('Mess',mess_schema)
const Notice=mongoose.model('Notice',notice_schema)
const Payment=mongoose.model('Payment',payment_schema)
const Resolved=mongoose.model("Resolved",resolved_schema)

//multer Configuration
//Memory Storage
// Set storage engine to memory storage

//home route
app.get('/',(req,res)=>{
     res.render('../views/home')
})

//Admin login route
app.get('/admin',function(req,res){
   res.render('../views/login_admin')
})

//Admin complaints view after login
app.post('/admin',async(req,res)=>{
  const name=req.body.username
  const pass=req.body.password
  const user=await Admin.findOne({username:name,password:pass});
    if(user){
        req.session.user = user;
        await Complaints.find().then((data)=>{
          res.render('admin_board',{complaint:data})
        })
     }
     else{
        res.redirect('/admin')
     }
})

//Student login route
app.get('/student',function(req,res){
   res.render('../views/login_student')
})
app.post('/student',async(req,res)=>{
  const name=req.body.username
  const pass=req.body.password
  const user=await Student.findOne({username:name,password:pass});
    if(user){
        req.session.user = user;
        Notice.find()
     .then(images => {
      res.render('stud_board', { images });
    })
    .catch(err => res.status(500).send(err));
     }
     else{
        res.redirect('/student')
     }
})

//student profile route
app.get('/student/profile',isAuthenticated,async(req,res)=>{
   await Student.findOne({_id:req.session.user._id}).then((data)=>{
    res.render('profile',{user:data})
   })
})

//admin profile route
app.get('/admin/profile',isAuthenticated,async(req,res)=>{
  await Admin.findOne({_id:req.session.user._id}).then((data)=>{
    res.render('admin_profile',{user:data})
  })
})

//student complaints
app.get('/student/complaint',isAuthenticated,async(req,res)=>{
   await Resolved.find({user_id:req.session.user._id}).then((data)=>{
    res.render('complaints',{complaint:data})
   })
})

app.post('/student/complaint',isAuthenticated,async(req,res)=>{
   const com=req.body.complaint
   const id=req.session.user._id
    await Student.findOne({_id:id}).then((data)=>{
      const room=data.Room_no
      const new_com=new Complaints({
        user_id:id,
        complaint:com,
        room_num:room,
      })
      new_com.save()
     res.redirect('/student/complaint')
    })
})

//Admin complaints route
app.get('/admin/complaint',isAuthenticated,async (req,res)=>{
  await Complaints.find().then((data)=>{
    res.render('admin_complaints',{complaint:data})
  })
})

app.post('/admin/complaint',isAuthenticated, async(req,res)=>{
  try {
    const {complaintId}  = req.body
    await Complaints.findOne({_id:complaintId}).then((data)=>{
      const new_res=new Resolved({
        admin_id:req.session.user._id,
        user_id:data.user_id,
        text:data.complaint,
        Room:data.room_num
     })
     new_res.save()
    })
    await Complaints.deleteOne({_id:complaintId})
      res.redirect('/admin/complaint')
  }
  catch (error) {
    console.error('Error resolving complaint:', error);
    res.status(500).json({ message: 'Internal server error' });
}
})

//student payment
app.get('/student/payment',isAuthenticated,(req,res)=>{
  res.render('../views/student_pay')
})

app.post('/student/payment', isAuthenticated,async(req, res) => {
  try {
    const student = await Student.findOne({ _id: req.session.user._id });
    if (student) {
      const year = student.year;
      const Branch = student.Branch;
      const fee = 30000;
      const new_pay = new Payment({
        user_id: req.session.user._id,
        amount: fee,
        Fullname: req.body.fullname,
        phone: req.body.phone,
        Hostel: req.body.hostel,
        year: year,
        Branch: Branch
      });
      await new_pay.save()
      res.render('../views/student_pay', { message: "Payment Successful!" })
    } else {
      res.status(404).send("Student not found")
    }
  }
   catch (err) {
    console.error(err);
    res.status(500).send("An error occurred during payment processing");
  }
});

//admin view payments
app.get('/admin/payment',isAuthenticated, async(req,res)=> {
  await Payment.find().then((data)=>{
    res.render('admin_payment',{payment:data})
  })
})
//student mess
app.get('/student/mess',isAuthenticated,async(req,res)=>{
  await Mess.find().then((data)=>{
    res.render('../views/student_mess',{messMenus:data})
  })
})

//admin edit mess route
app.get('/admin/mess',isAuthenticated,(req,res)=>{
  res.render('../views/mess')
})

app.post('/admin/mess',isAuthenticated,async(req,res)=>{
  const day=req.body.mealDay
  const type=req.body.mealType
  const new_mess=req.body.menuItems
  if(type=="breakfast"){
    await Mess.updateOne({day:day},
      { $set:
         { breakfast: new_mess }
      })
  }
  else if(type=="lunch"){
    await Mess.updateOne({day:day},
      { $set:
        { Lunch: new_mess }
   })
  }
  else if(type=="dinner"){
    await Mess.updateOne({day:day},
      { $set:
         { Dinner: new_mess }
   })
  }
  res.render('../views/mess',{message:"Updated Successfully!"})
})

//admin search student route
app.get('/admin/view',isAuthenticated, async (req, res) => {
  const query = req.query.query;
  try {
      const students = await Student.find({
          $or: [
              { Room_no: query },
              { phone: query },
              { Branch :query}
          ]
      });
      res.render('view_students', { students });
  }
   catch (err) {
      res.status(500).send('Error searching for students.');
  }
});

//admin add notice route
app.get('/admin/notice',isAuthenticated,(req,res)=>{
  res.render('../views/notices')
})

app.post('/admin/notice',upload.single('image'),  isAuthenticated,(req, res) => {
  const imgBase64 = req.file.buffer.toString('base64');
  const imgToStore = {
    data: imgBase64,
    contentType: req.file.mimetype
  };
  const newImage = new Notice(imgToStore);
   newImage.save()
    .then(() => res.render('notices',{message:"Uploaded Successfully"}))
    .catch(err => res.status(500).send(err));
});

//logout route
app.post('/logout',(req,res)=>{
  req.session.destroy()
  res.redirect('/')
})

//Server & Port
app.listen(3000,function(err){
    if(!err)
        console.log('Server Connected')
    else
        console.log('Error!')
})
