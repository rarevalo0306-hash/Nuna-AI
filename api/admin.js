const {verifiedSession,isAdminSession}=require('./_supabase');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
 const token=(/^Bearer\s+([\w.-]{20,4096})$/i.exec(req.headers.authorization||'')||[])[1];
 const user=await verifiedSession(token);if(!user)return res.status(401).json({error:'login_required'});
 if(!await isAdminSession(token,user))return res.status(403).json({error:'admin_required'});
 return res.status(200).json({administrator:{email:user.email},businessDataConnected:false});
};
