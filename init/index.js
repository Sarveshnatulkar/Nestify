const mongoose=require("mongoose");
const initData=require("./data.js");
const Listing=require("../models/listing.js");

const mongo_url="mongodb+srv://Sarvesh:NSbAUOiqO64rDeHW@smartnotes.bs6xs2h.mongodb.net/nestify?retryWrites=true&w=majority&appName=SmartNotes";
main().then(()=>{
    console.log("connected to db");
}).catch((err)=>{
    console.log(err);
});
async function main(){
    await mongoose.connect(mongo_url);
}

const initDB=async()=>{
    await Listing.deleteMany({});
    initData.data=initData.data.map((obj)=>({
        ...obj,
        owner:"6a4967cb03c1242c4631bcfe"
    }));
    await Listing.insertMany(initData.data);
    console.log("data was initiliased");
}
initDB();
