const { chromium } = require('playwright-chromium');
const fs = require('fs');
const pageUrl = "https://www.tokopedia.com/p/handphone-tablet/handphone"

const maxProductToTake = 5;
const singleProduct     = {
  "url": null,
  "name": null,
  "price": 0,
  "store": null,
  "imageUrl": null,
  "rating": null,
  "description": null
}
const browserOptions = {
  headless: false,
  chromiumSandbox: false,
  slowMo: 50,
};

let browser = null;
let browserContext = null;
let page = null;

let productList = [];

runProcess(`${pageUrl}`)
.then(async _ => {
  await collectDescription();
  await writeToCsv();
  // console.log(productList);
  shutdownProcess();
})

async function runProcess(url) {
  browser = await chromium.launch(browserOptions);
  browserContext = await browser.newContext();
  page = await browserContext.newPage();

  await getProducts(url, 1);
};

async function getProducts(url, pageNumber){
  console.log('================================================');
  console.log(`Start scraping tokopedia: ${url}?page=${pageNumber}`);
  await page.goto(`${url}?page=${pageNumber}`, { waitUntil: "domcontentloaded" });

  const takeProduct = [];
  const currIdx = productList.length;
  const productSectionXpath = `//div[@data-testid='lstCL2ProductList']/div/a`;
  const titleXpath  = `${productSectionXpath}/div[2]/div[2]/span`;
  const imgXpath    = `${productSectionXpath}/div[2]/div[1]/div/div/img`;
  const priceXpath  = `${productSectionXpath}/div[2]/div[2]/div[1]/div/span`;
  const ratingXpath = `${productSectionXpath}/div[2]/div[2]/div[3]`;
  const storeXpath  = `${productSectionXpath}/div[2]/div[2]/div[2]/div[2]/span[2]`;


  const urlListEl = await page.$$(productSectionXpath);
  const urlList = [];
  for (const p of urlListEl) {
    const actualPara = await page.evaluate(el => el.href, p)
    const tf = actualPara.indexOf("ta.tokopedia") < 0;

    urlList.push(actualPara)
    takeProduct.push(tf);
    if(tf){
      const sp = Object.assign({}, singleProduct);
      sp.url = actualPara;
      productList.push(sp);
    }
  }

  const productListEl = await page.$$(titleXpath);
  const productNameList = [];
  let counter = 0;
  let idx = currIdx;
  for (const p of productListEl) {
    const actualPara = await page.evaluate(el => el.innerText.trim(), p)
    productNameList.push(actualPara)
    
    if(takeProduct[counter]){
      productList[idx].name = actualPara;
      idx++;
    }
    counter++;
  }

  const imageListEl = await page.$$(imgXpath);
  const imageUrlList = [];
  counter = currIdx;
  idx = currIdx;
  for (const p of imageListEl) {
    const actualPara = await page.evaluate(el => el.src, p)
    imageUrlList.push(actualPara);

    if(takeProduct[counter]){
      productList[idx].imageUrl = actualPara;
      idx++;
    }
    counter++;
  }

  const priceListEl = await page.$$(priceXpath);
  const priceList = [];
  counter = 0;
  idx = currIdx;
  for (const p of priceListEl) {
    const actualPara = await page.evaluate(el => el.innerText.trim(), p)
    priceList.push(actualPara);

    if(takeProduct[counter]){
      productList[idx].price = actualPara;
      idx++;
    }
    counter++;
  }

  const ratingEl = await page.$$(ratingXpath);
  const ratingList = [];
  counter = 0;
  idx = currIdx;
  for (const el of ratingEl) {
    const actualPara = await el.$$eval("img[src='https://assets.tokopedia.net/assets-tokopedia-lite/v2/zeus/kratos/4fede911.svg']", ll => ll.length)
    ratingList.push(actualPara);

    if(takeProduct[counter]){
      productList[idx].rating = actualPara;
      idx++;
    }
    counter++;
  }

  const storeListEl = await page.$$(storeXpath);
  const storeNameList = [];
  counter = takeProduct.indexOf(true);
  idx = currIdx;
  for (const p of storeListEl) {
    const actualPara = await page.evaluate(el => el.innerText.trim(), p)
    storeNameList.push(actualPara)
    if(takeProduct[counter]){
      productList[idx].store = actualPara;
      idx++;
    }
    counter++;
  }

  // console.log(takeProduct);

  if(productList.length < maxProductToTake){
    await getProducts(url, pageNumber+1);
  }
}

async function collectDescription(idx = 0){
  const product = productList[idx];
  productList[idx].description = await getDesc(product.url);

  if(idx < productList.length-1){
    await collectDescription(idx+1);
  }
}

async function getDesc(url){
  const pg = await browserContext.newPage();
  await pg.goto(`${url}`, { waitUntil: "domcontentloaded" });
  await delay(2000);
  const descSection = `//div[@data-testid='lblPDPDescriptionProduk']`;
  const p = await pg.$(descSection);
  const desc = await pg.evaluate(el => {
    if(el != null){
      return el.innerText.trim().replaceAll("\n", "<br/>")
    }else{
      return "not found."
    }
  }, p)
  pg.close();
  return desc;
}

async function writeToCsv(){
  var file = fs.createWriteStream('result.csv');
  file.on('error', function(err) { /* error handling */ });
  file.write('URL||Product Name||Price||Store Name||Image URL||Rating||Description\n');
  productList.forEach(function(product) {
    const v = Object.values(product);
    file.write(v.join('||') + '\n'); 
  });
  file.end();
}

async function shutdownProcess() {
  console.log('Closing Proses');
  await browserContext.close();
  await browser.close();
  process.exit(0);
}

process.on('SIGINT', async () => {
  await shutdownProcess();
  process.exit(0);
});
const delay = ms => new Promise(res => setTimeout(res, ms));
