import { readFileSync, writeFileSync, mkdirSync } from 'fs';
const b64 = readFileSync('/home/ubuntu/workspace/.platform/attachments/rate-019e1f04-a622-718e-af3b-6fb10cb10a4d.csv', 'utf8').trim();
const decoded = Buffer.from(b64, 'base64').toString('utf8');
mkdirSync('/home/ubuntu/workspace/app/src/frontend/public/assets', {recursive:true});
writeFileSync('/home/ubuntu/workspace/app/src/frontend/public/assets/investigation-rates.csv', decoded);
console.log('Done. Lines:', decoded.split('\n').length);
console.log('First 5 lines:');
decoded.split('\n').slice(0,5).forEach(l=>console.log(l));
