var serviceWorker = {};
const registerServiceWorker = () => {
  if (!navigator.serviceWorker) return;
  navigator.serviceWorker.register('./sw.js').then(reg => {
    if (!navigator.serviceWorker.controller) {
      return;
    }

    if (reg.waiting) {
      serviceWorker = reg.waiting;
      updateReady(reg.waiting);
      return;
    }

    if (reg.installing) {
      serviceWorker = reg.installing;
      trackInstalling(reg.installing);
      return;
    }

    reg.addEventListener('updatefound', () => {
      serviceWorker = reg.installing;
      trackInstalling(reg.installing);
    });
  });

  // Ensure refresh is only called once.
  // This works around a bug in "force update on reload".
  let refreshing;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    window.location.reload();
    refreshing = true;
  });
};

const trackInstalling = worker => {
  worker.addEventListener('statechange', () => {
    if (worker.state == 'installed') {
      updateReady(worker);
    }
  });
};


const updateReady = (worker) => {
  const toast = document.getElementById("simple-toast");
  toast.setAttribute("class", "visible")
};

const dbPromise = idb.open('currency-db', 2, upgradeDb => {
  switch(upgradeDb.oldVersion) {
    case 0:
      const currStore = upgradeDb.createObjectStore('currencies', { keyPath: 'name' });
      currStore.createIndex('name', 'name');
    case 1:
      const convStore = upgradeDb.createObjectStore('conversions', { keyPath: 'name' });
      convStore.createIndex('name', 'name');
  }
});

const splitDecimal = n => {
  const rsltWhole = document.getElementById('whole');
  const rsltDecimal = document.getElementById('decimal');
  const decimal = n - Math.floor(n);
  const whole = Math.floor(n);
  rsltWhole.innerHTML = whole;
  rsltDecimal.innerHTML = String(decimal).split('.')[1] ? `.${String(decimal).split('.')[1]}` : "";
}


registerServiceWorker();



// USING PURE JS To AVOID NEEDING TO CACHE JQUERY , SAVE MEMORY
document.addEventListener("DOMContentLoaded", () => {
  const currencyFrom = document.getElementById('from');
  const currencyTo = document.getElementById('to');
  const amount = document.getElementById('amount');
  const result = document.getElementById('result');
  const fromCurrLbl = document.getElementById('from-curr');
  const toCurrLbl = document.getElementById('to-curr');
  const errorText = document.getElementById('errorText');
  const reverse = document.getElementById('switch');
  const rsltWhole = document.getElementById('whole');
  const rsltDecimal = document.getElementById('decimal');
  const toast = document.getElementById('simple-toast');
  const refresh = document.getElementById('refresh');
  const dismiss = document.getElementById('dismiss');

  refresh.onclick = e => {
      console.log("refreshed");
      serviceWorker.postMessage({action: 'skipWaiting'});
  }
  dismiss.onclick = e => {
    toast.setAttribute("class", "")
  }

  const convertCurrency = e => {

    const query = `${currencyFrom.value}_${currencyTo.value}`;
    const invQuery = `${currencyTo.value}_${currencyFrom.value}`;
    toCurrLbl.innerHTML = currencyTo.value;
    fromCurrLbl.innerHTML = currencyFrom.value;
    if (amount.value) {
      dbPromise.then(db => {
        const tx = db.transaction('conversions');
        const convStore = tx.objectStore('conversions');
        return convStore.get(query);
      }).then(dbCurrency => {
        if (dbCurrency) {
          // IF LAST UPDATED MORE THAN AN HOUR AGO, LOAD FROM NETWORK AND UPDATE DB
          const oneHour = 60 * 60 * 1000;

          if((new Date() - dbCurrency.lastUpdate) > oneHour){
            try {
              $.getJSON(`https://free.currencyconverterapi.com/api/v5/convert?q=${query}&compact=y&callback=?`, json => {
                console.log("update DB");
                dbPromise.then(db => {
                  const tx = db.transaction('conversions', 'readwrite');
                  const convStore = tx.objectStore('conversions');
                  convStore.put({name: query, value: json[query].val, lastUpdate: new Date()});
                  convStore.put({name: invQuery, value: 1/json[query].val, lastUpdate: new Date()});

                  return tx.complete;
                }).then(() => {

                  splitDecimal(json[query].val*amount.value);
                  errorText.innerHTML = "";
                });
              }).catch(e => {
                console.log("value loaded from db");

                splitDecimal(dbCurrency.value*amount.value);
                errorText.innerHTML = `Please connect to the internet to update currency database`;
              });
            } catch (e) {
                console.log("no internet");
                console.log("value loaded from db");

                splitDecimal(dbCurrency.value*amount.value);
                errorText.innerHTML = `Please connect to the internet to update currency database`;
            }
          } else {
            splitDecimal(dbCurrency.value*amount.value);
          }
          errorText.innerHTML = "";
        } else {
          if(currencyFrom.value === currencyTo.value){
            splitDecimal(amount.value);
          } else {
            try {
              $.getJSON(`https://free.currencyconverterapi.com/api/v5/convert?q=${query}&compact=y&callback=?`, json => {
                dbPromise.then(db => {
                  const tx = db.transaction('conversions', 'readwrite');
                  const convStore = tx.objectStore('conversions');
                  convStore.put({name: query, value: json[query].val, lastUpdate: new Date()});
                  convStore.put({name: invQuery, value: 1/json[query].val, lastUpdate: new Date()});

                  return tx.complete;
                }).then(() => {
                  splitDecimal(json[query].val*amount.value);

                  errorText.innerHTML = "";
                });
              }).catch(e => {
                console.log("error", e);
                errorText.innerHTML = `Network ${e.statusText} ${e.status}`;
              });
            } catch (e) {
                console.log("no internet");
                // result.innerHTML = ""

                rsltWhole.innerHTML = "";
                rsltDecimal.innerHTML = "";
                errorText.innerHTML = `Please connect to the internet to update currency database`;

            }
          }
        }
      });
    } else {
      rsltWhole.innerHTML = 0;
    }
  };

  dbPromise.then(db => {
    const tx = db.transaction('currencies');
    const currStore = tx.objectStore('currencies');
    const nameIndex = currStore.index('name');

    return nameIndex.getAll();
  }).then(currencies => {
      // console.log(currencies);
      if(currencies.length > 0){
        for (currency of currencies) {
          let opt = document.createElement('option');
          opt.value = currency.id;
          opt.innerHTML = currency.name;
          let clone = opt.cloneNode(true);
          if (currency.id == "USD") {
            opt.selected = true;
            clone.selected = true;
          }
          currencyFrom.appendChild(opt);
          currencyTo.appendChild(clone);
        }
      } else {
        if($){
          $.getJSON("https://free.currencyconverterapi.com/api/v5/currencies", json => {
            currencies = json.results;
            for (const curr in currencies) {
              const currency = currencies[curr];
              dbPromise.then(db => {
                const tx = db.transaction('currencies', 'readwrite');
                const currStore = tx.objectStore('currencies');
                currStore.put({name: currency.currencyName, id: currency.id});
                return tx.complete;
              }).then(() => {
                console.log('Added to db');
                let curr = {
                  value: currency.id,
                  text: currency.currencyName
                }
                if (currency.id == "USD") {
                  curr.selected = true;
                }
                $('.currencySelect').append($('<option>', curr));
              });
            }
          });
        } else {
          // errorText.innerHTML = `Network ${e.statusText} ${e.status}`;
          errorText.innerHTML = `Please connect to the internet to update currency database`;
          // console.log("no network");
        }
      }
  });

  currencyFrom.onchange = convertCurrency;
  currencyTo.onchange = convertCurrency;
  amount.onkeyup = convertCurrency;
  reverse.onclick = e => {
    const dummy = currencyTo.value;
    currencyTo.value = currencyFrom.value;
    currencyFrom.value = dummy;
    convertCurrency();
  }
});
