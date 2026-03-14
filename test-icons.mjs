import * as icons from '@hugeicons/core-free-icons';
const names = Object.keys(icons);
console.log('Plus icons:', names.filter(n => n.toLowerCase().includes('plus')).slice(0, 5));
console.log('Download icons:', names.filter(n => n.toLowerCase().includes('download')).slice(0, 5));
console.log('Arrow right icons:', names.filter(n => n.toLowerCase().includes('arrowright')).slice(0, 5));
console.log('Wallet icons:', names.filter(n => n.toLowerCase().includes('wallet')).slice(0, 5));
console.log('Safe icons:', names.filter(n => n.toLowerCase().includes('safe')).slice(0, 5));
console.log('Activity icons:', names.filter(n => n.toLowerCase().includes('activity')).slice(0, 5));
console.log('Arrow icons:', names.filter(n => n.toLowerCase().includes('arrowdown')).slice(0, 5));
