if(location.hash==='#error'){document.getElementById('loading').hidden=true;document.getElementById('error').style.display='block';}
document.getElementById('retry').addEventListener('click',()=>(window.phoenixStartup || window.kopyStartup)?.retry?.());
