if(process.env.NODE_ENV != "production"){
    require('dotenv').config();
}

const mongoose=require("mongoose");
const initData=require("./data.js");
const Listing=require("../models/listing.js");
const User=require("../models/user.js");

const mongo_url=process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/nestify";

main().then(()=>{
    console.log("connected to db");
}).catch((err)=>{
    console.log(err);
});
async function main(){
    await mongoose.connect(mongo_url);
}

const initDB=async()=>{
    // Find the first available user to assign as owner, or create a seed user
    let seedUser=await User.findOne({});
    if(!seedUser){
        seedUser=new User({username:"seeduser",email:"seed@nestify.com"});
        await User.register(seedUser,"Seed@1234");
        console.log("Seed user created: username=seeduser, password=Seed@1234");
    }

    await Listing.deleteMany({});
    initData.data=initData.data.map((obj)=>({
        ...obj,
        owner:seedUser._id,
    }));
    await Listing.insertMany(initData.data);
    console.log("data was initialised");
}
initDB();
