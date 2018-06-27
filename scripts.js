registerServiceWorker = () => {
  if (!navigator.serviceWorker) return;

  var indexController = this;

  navigator.serviceWorker.register('./sw.js').then(function(reg) {
    if (!navigator.serviceWorker.controller) {
      return;
    }
  });
};

const dbPromise = idb.open('currency-db', 2, function(upgradeDb) {
  switch(upgradeDb.oldVersion) {
    case 0:
      const currStore = upgradeDb.createObjectStore('currencies', { keyPath: 'name' });
      currStore.createIndex('name', 'name');
    case 1:
      const convStore = upgradeDb.createObjectStore('conversions', { keyPath: 'name' });
      convStore.createIndex('name', 'name');
  }
});

registerServiceWorker();

document.addEventListener("DOMContentLoaded", function(){
  const currencyFrom = document.getElementById('from');
  const currencyTo = document.getElementById('to');
  const amount = document.getElementById('amount');
  const result = document.getElementById('result');


  const convertCurrency = e => {

    // console.log(amount.value, currencyTo.value, currencyFrom.value)
    // console.log(e.target.value);
    const query = `${currencyFrom.value}_${currencyTo.value}`;
    const invQuery = `${currencyTo.value}_${currencyFrom.value}`;
    if (amount.value && currencyTo.value !== "undefined" && currencyFrom.value !== "undefined") {
      dbPromise.then(function(db) {
        const tx = db.transaction('conversions');
        const convStore = tx.objectStore('conversions');
        return convStore.get(query);
      }).then(function(val) {
        if (val) {
          console.log("value loaded from db");
          result.innerHTML = val.value*amount.value;
        } else {
          if(currencyFrom.value === currencyTo.value){
            result.innerHTML = amount.value;
          } else {
            try {
              $.getJSON(`https://free.currencyconverterapi.com/api/v5/convert?q=${query}&compact=y&callback=?`, json => {
                dbPromise.then(function(db) {
                  const tx = db.transaction('conversions', 'readwrite');
                  const convStore = tx.objectStore('conversions');
                  convStore.put({name: query, value: json[query].val});
                  convStore.put({name: invQuery, value: 1/json[query].val});
                  return tx.complete;
                }).then(function() {
                  result.innerHTML = json[query].val*amount.value;
                });
              }).catch(e => {
                console.log("error lala", e);
                result.innerHTML = `Network ${e.statusText} ${e.status}`;
              });
            } catch (e) {
                console.log("no internet");
            }
          }
        }
      });
    }
  };

  dbPromise.then(function(db) {
    const tx = db.transaction('currencies');
    const currStore = tx.objectStore('currencies');
    const nameIndex = currStore.index('name');

    return nameIndex.getAll();
  }).then(function(currencies) {
      // console.log(currencies);
      if(currencies.length > 0){
        for (currency of currencies) {
          var opt = document.createElement('option');
          opt.value = currency.id;
          opt.innerHTML = currency.name;
          var clone = opt.cloneNode(true);
          currencyFrom.appendChild(opt);
          currencyTo.appendChild(clone);
        }
      } else {
        $.getJSON("https://free.currencyconverterapi.com/api/v5/currencies", json => {
          // console.log(json.results);
          currencies = json.results;
          for (const curr in currencies) {
            const currency = currencies[curr];
                  // set "foo" to be "bar" in "keyval"
            dbPromise.then(function(db) {
              const tx = db.transaction('currencies', 'readwrite');
              const currStore = tx.objectStore('currencies');
              currStore.put({name: currency.currencyName, id: currency.id});
              return tx.complete;
            }).then(function() {
              console.log('Added to db');
              $('.currencySelect').append($('<option>', {
                  value: currency.id,
                  text: currency.currencyName
              }));
            });
          }
        });
      }
  });

  currencyFrom.onchange = convertCurrency;
  currencyTo.onchange = convertCurrency;
  amount.onkeyup = convertCurrency;

});
