import os from 'node:os';
os.userInfo=()=>({uid:-1,gid:-1,username:'local',homedir:process.env.USERPROFILE,shell:null});
