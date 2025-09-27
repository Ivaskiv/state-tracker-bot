export const buildCb = (obj) => Object.entries(obj).map(([k,v]) => `${k}=${String(v)}`).join('|');
export const parseCb = (s='') => s.split('|').reduce((a,p)=>{const [k,...r]=p.split('=');if(k)a[k]=r.join('=');return a;}, {});
