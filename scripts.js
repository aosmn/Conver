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

$(()=>{
  const currencyFrom = $("#from");
  const currencyTo = $("#to");
  const amount = $("#amount");
  const result = $("#result");

  dbPromise.then(function(db) {
    const tx = db.transaction('currencies');
    const currStore = tx.objectStore('currencies');
    const nameIndex = currStore.index('name');

    return nameIndex.getAll();
  }).then(function(currencies) {
      // console.log(currencies);
      if(currencies.length > 0){
        for (currency of currencies) {
          $('.currencySelect').append($('<option>', {
            value: currency.id,
            text: currency.name
          }));
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


  const convertCurrency = e => {
    // console.log(e.target.value);
    const query = `${currencyFrom.val()}_${currencyTo.val()}`;
    const invQuery = `${currencyTo.val()}_${currencyFrom.val()}`;
    if (amount.val() && currencyTo.val() && currencyFrom.val() ) {
      dbPromise.then(function(db) {
        const tx = db.transaction('conversions');
        const convStore = tx.objectStore('conversions');
        return convStore.get(query);
      }).then(function(val) {
        if (val) {
          console.log("value loaded from db");
          result.html(val.value*amount.val());
        } else {
          if(currencyFrom.val() === currencyTo.val()){
            result.html(amount.val());
          } else {
            $.getJSON(`https://free.currencyconverterapi.com/api/v5/convert?q=${query}&compact=y&callback=?`, json => {
              // console.log(json[query].val*amount.val());
              dbPromise.then(function(db) {
                const tx = db.transaction('conversions', 'readwrite');
                const convStore = tx.objectStore('conversions');
                convStore.put({name: query, value: json[query].val});
                convStore.put({name: invQuery, value: 1/json[query].val});
                return tx.complete;
              }).then(function() {
                result.html(json[query].val*amount.val());
              });
            });
          }
        }
      });
    }
  };

  $(".currencySelect").change(convertCurrency);
  amount.keyup(convertCurrency);


  registerServiceWorker = () => {
    if (!navigator.serviceWorker) return;

    var indexController = this;

    navigator.serviceWorker.register('/sw.js').then(function(reg) {
      if (!navigator.serviceWorker.controller) {
        return;
      }
    });
  };
  registerServiceWorker();

});
