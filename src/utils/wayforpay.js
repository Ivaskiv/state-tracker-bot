//wayforpay.js
export function getWayforpayLink({ tgId, orderReference, productName, plan }) {
  const baseUrl = "https://secure.wayforpay.com/button/";
  let buttonId;

  switch(plan) {
    case 'weekly': buttonId = "b96923b913d29"; break;
    case 'monthly': buttonId = "b8df87678cd43"; break;
    case 'yearly': buttonId = "bf28701123683"; break;
    default: buttonId = ""; break;
  }

  return `${baseUrl}${buttonId}?tg_id=${tgId}&orderReference=${orderReference}&productName=${encodeURIComponent(productName)}`;
}
