const {currentClock}=require('./_clock');
module.exports=function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
 return res.status(200).json(currentClock(req.query?.timeZone));
};
