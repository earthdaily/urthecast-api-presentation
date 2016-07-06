var orderSceneId = 'RIsvgmw9S2q1qKWSCfDPmg';
var orderGeoJson = null;
var orderStatusTimeout = null;

function orderDemo(event) {
  if (event.currentSlide.classList.contains('order-demo-slide') && !orderGeoJson) {
    orderGeoJson = L.geoJson(JSON.parse(localStorage.getItem('sf-aoi-geometry')));

    var center = orderGeoJson.getBounds().getCenter();

    initMap(center.lat, center.lng, 12);

    map.fitBounds(orderGeoJson, {
      maxZoom: 12,
    });

    var layerUrl = makeUrl('https://tile-{s}.urthecast.com/v1/rgb/{z}/{x}/{y}', {
      id: orderSceneId,
    });

    createLayer(layerUrl);
  }

  if (event.currentSlide.id === 'order-demo') {
    map.removeLayer(orderGeoJson);
  } else if (event.currentSlide.classList.contains('order-demo-slide')) {
    map.addLayer(orderGeoJson);
  } else if (orderGeoJson) {
    map.removeLayer(orderGeoJson);
    orderGeoJson = null;
  }

  if (event.currentSlide.id === 'order-demo-3') {
    updateOrderCreateUrl();
  } else if (event.currentSlide.id === 'order-demo-4') {
    updateOrderCreateLineItemUrl();
  } else if (event.currentSlide.id === 'order-demo-6') {
    updateOrderPurchaseUrl();
  } else if (event.currentSlide.id === 'order-demo-7') {
    updateOrderStatusUrl();
  } else if (event.currentSlide.id === 'order-demo-8') {
    updateOrderDownloadUrl();
  } else if (event.currentSlide.id === 'order-demo-10') {
    updateOrderToolCommand();
  }
}

Reveal.addEventListener('ready', orderDemo);
Reveal.addEventListener('slidechanged', orderDemo);

// Step 1: Create an order

function getOrderCreateUrl() {
  return makeUrl('https://api.urthecast.com/v1/ordering/orders');
}

function updateOrderCreateUrl() {
  var createUrl = getOrderCreateUrl();
  document.querySelector('#order-create-url').textContent = '[POST] ' + createUrl;
}

document.querySelector('#order-create-link').addEventListener('click', function(evt) {
  evt.preventDefault();

  var createUrl = getOrderCreateUrl();

  makeRequest(createUrl, 'order-create-results', {
    type: 'POST',
    complete: function(data) {
      if (data.payload && data.payload.length) {
        var order = data.payload[0];
        localStorage.setItem('order-id', order.id);
      }
    },
  });
});

// Step 2: Create a line item

function getOrderCreateLineItem() {
  var orderId = localStorage.getItem('order-id');

  return {
    url: makeUrl('https://api.urthecast.com/v1/ordering/orders/' + orderId + '/line_items'),
    data: {
      type: 'scene',
      metadata: {
        scene_id: orderSceneId,
        datasets: $('#order-bands').val(),
        geometry: localStorage.getItem('sf-aoi-id'),
      },
    },
  };
}

function updateOrderCreateLineItemUrl() {
  var createLineItem = getOrderCreateLineItem();

  // Condense bands array for brevity
  stringifyArrayToSingleLine(createLineItem.data.metadata, 'datasets');

  document.querySelector('#order-create-line-item-url').textContent = '[POST] ' + createLineItem.url + '\n\n' + JSON.stringify(createLineItem.data, null, 4).replace(/\\"/g, '"');
}

document.querySelector('#order-bands').addEventListener('change', function() {
  var createLink = document.querySelector('#order-create-line-item-link');
  var bands = $(this).val();

  if (bands) {
    createLink.classList.add('in');
  } else {
    createLink.classList.remove('in');
  }

  updateOrderCreateLineItemUrl();
});

document.querySelector('#order-create-line-item-link').addEventListener('click', function(evt) {
  evt.preventDefault();

  var createLineItem = getOrderCreateLineItem();

  makeRequest(createLineItem.url, 'order-create-line-item-results', {
    type: 'POST',
    data: createLineItem.data,
    complete: function(data) {
      if (data.payload && data.payload.length) {
        // Condense bands array for brevity
        stringifyArrayToSingleLine(data.payload[0].metadata, 'datasets');

        // Trim coordinates for brevity
        data.payload[0].metadata.geometry.coordinates = '...';
      }

      Reveal.next();
    },
    done: function(results) {
      results.textContent = results.textContent.replace(/\\"/g, '"');
    },
  });
});

// Step 3: Purchase the order

function getOrderPurchase() {
  return {
    url: makeUrl('https://api.urthecast.com/v1/ordering/purchase'),
    data: {
      order_id: localStorage.getItem('order-id'),
    },
  };
}

function updateOrderPurchaseUrl() {
  var purchase = getOrderPurchase();
  document.querySelector('#order-purchase-url').textContent = '[POST] ' + purchase.url + '\n\n' + JSON.stringify(purchase.data, null, 4);
}

document.querySelector('#order-purchase-link').addEventListener('click', function(evt) {
  evt.preventDefault();

  var purchase = getOrderPurchase();

  makeRequest(purchase.url, 'order-purchase-results', {
    type: 'POST',
    data: purchase.data,
  });
});

// Step 4: Check order status

function getOrderStatusUrl() {
  var orderId = localStorage.getItem('order-id');
  return makeUrl('https://api.urthecast.com/v1/ordering/orders/' + orderId);
}

function updateOrderStatusUrl() {
  var statusUrl = getOrderStatusUrl();
  document.querySelector('#order-status-url').textContent = statusUrl;
}

function checkOrderStatus() {
  if (orderStatusTimeout != null) {
    // Clear the timeout if the user clicks the "Check Order Status" link again instead of waiting
    clearTimeout(orderStatusTimeout);
    orderStatusTimeout = null;
  }

  var statusUrl = getOrderStatusUrl();

  var results = document.querySelector('#order-status-results');
  results.classList.remove('not-delivered', 'delivered');

  var note = document.querySelector('#order-status-note');
  note.classList.remove('in', 'hidden');

  var deliveryLink = document.querySelector('#order-delivery-link');
  deliveryLink.classList.remove('in');

  makeRequest(statusUrl, results.id, {
    complete: function(data) {
      orderStatusTimeout = null;

      if (data.payload && data.payload.length) {
        var order = data.payload[0];

        if (order.state === 'delivered') {
          results.classList.add('delivered');
          note.classList.add('hidden');
          deliveryLink.classList.add('in');
        } else {
          results.classList.add('not-delivered');

          if (order.state === 'processing' && Reveal.getCurrentSlide().id === 'order-demo-7') {
            note.classList.add('in');

            // Automatically check the order status again after 15 seconds as it is still processing
            orderStatusTimeout = setTimeout(checkOrderStatus, 15000);
          }
        }

        replaceObject(data, order);
      }
    },
  });
}

document.querySelector('#order-status-link').addEventListener('click', function(evt) {
  evt.preventDefault();
  checkOrderStatus();
});

// Step 5: Get/download order

function getOrderDownloadUrl() {
  return makeUrl('https://api.urthecast.com/v1/ordering/deliveries', {
    order_id: localStorage.getItem('order-id'),
  });
}

function updateOrderDownloadUrl() {
  var statusUrl = getOrderDownloadUrl();
  document.querySelector('#order-download-url').textContent = statusUrl;
}

document.querySelector('#order-delivery-link').addEventListener('click', function(evt) {
  evt.preventDefault();

  document.querySelector('#order-download-url').classList.add('in');

  var downloadUrl = getOrderDownloadUrl();

  var downloadLink = document.querySelector('#order-download-link');
  downloadLink.classList.remove('in');

  makeRequest(downloadUrl, 'order-delivery-results', {
    complete: function(data) {
      if (data.payload && data.payload.length) {
        var delivery = data.payload[0];

        downloadLink.href = delivery.url;
        downloadLink.classList.add('in');

        replaceObject(data, delivery);
      }

      Reveal.next();
    },
  });
});

// CLI tool command

function updateOrderToolCommand() {
  var aoiId = localStorage.getItem('sf-aoi-id');
  document.querySelector('#order-tool-command').textContent = 'python order.py ' + orderSceneId + ' ' + aoiId;
}

//
// Helper methods
//

function makeUrl(url, params) {
  var queryString = $.param($.extend({
    api_key: localStorage.getItem('apiKey'),
    api_secret: localStorage.getItem('apiSecret'),
  }, params));

  return url + '?' + queryString;
}

function makeRequest(url, resultsId, options) {
  var results = document.getElementById(resultsId);
  results.classList.add('in');
  results.textContent = 'Loading...';

  var status = document.getElementById(resultsId.replace('results', 'status'));

  if (status) {
    status.classList.remove('in');
  }

  $.ajax({
    type: options.type || 'GET',
    url: url,
    contentType: 'application/json',
    data: JSON.stringify(options.data),
    complete: function(xhr) {
      var data = xhr.responseJSON;

      if (options.complete) {
        options.complete.call(this, data);
      }

      results.textContent = JSON.stringify(data, null, 4);

      if (status) {
        status.classList.add('in');
        status.textContent = xhr.statusText;
      }

      if (options.done) {
        options.done.call(this, results);
      }
    },
  });
}

function stringifyArrayToSingleLine(data, key) {
  var arr = data[key];

  // Hack to get JSON.stringify to print array values on a single line instead of multiple
  if (arr) {
    arr = arr.join('", "');
    arr = [arr];
  } else {
    arr = [''];
  }

  data[key] = arr;
}

/**
 * Replace an object with new data without losing reference to the original object
 */
function replaceObject(obj, data) {
  // First, clear the object of all existing properties
  for (var prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      delete obj[prop];
    }
  }

  // Then, copy the properties from 'data' into 'obj'
  for (var prop in data) {
    if (data.hasOwnProperty(prop)) {
      obj[prop] = data[prop];
    }
  }
}
