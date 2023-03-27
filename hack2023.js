// let map;
let autocomplete;


window.onload = function () {
  const video = document.getElementById("myVideo");
  video.style.height = window.innerHeight = "px";
};

window.onresize = function() {
  const video = document.getElementById("myVideo");
  video.style.height = window.innerHeight + "px";
}


function initMap() {

  const addressInput = document.getElementById("address-input");

  // Initialize autocomplete for the text input
  autocomplete = new google.maps.places.Autocomplete(addressInput);

  // Add a place_changed event listener to the autocomplete object
  autocomplete.addListener("place_changed", onPlaceChanged);

  const voiceButton = document.getElementById("voice-button");
  const recognition = new window.webkitSpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';  
  voiceButton.addEventListener('click', () => {
    // start recording the user's voice
    recognition.start();
  });

  recognition.addEventListener('result', (event) => {
    // get the transcript of the user's speech
    const transcript = event.results[0][0].transcript;
  
    // insert the transcript into the input box
    addressInput.value += transcript;
  });


   gapi.load('client', function() {
    gapi.client.init({
      apiKey: 'GOOGLE_API_KEY_HERE',
      clientId: '13163583024-c4fivcm7s90g5lga1nc8g7d4t6fumufu.apps.googleusercontent.com',
      discoveryDocs: ['https://vision.googleapis.com/$discovery/rest?version=v1'],
      scope: 'https://www.googleapis.com/auth/cloud-platform'
    }).then(function() {
      // Authentication succeeded
    }, function(error) {
      // Authentication failed
      console.error(error);
    });
  });

}

function onPlaceChanged() {
  // Get the selected place from the autocomplete object
  const place = autocomplete.getPlace();
  // Convert the place address to latitude and longitude coordinates
  const lat = place.geometry.location.lat();
  const lng = place.geometry.location.lng();

  // Remove the address text input from the view
  const addressInput = document.querySelector("input[type='text']");
  const addressInputElement = document.getElementById("address-input");
  // addressInputElement.remove();
  addressInput.style.display = "none";
  backgroundVideo = document.getElementById("myVideo");
  backgroundVideo.style.display="none";
  const voiceButton = document.getElementById("voice-button");
  voiceButton.style.display="none";
  const logo = document.getElementById("logo");
  logo.style.display="none";
  // const loading = document.getElementById("loading");
  // loading.style.display="initial"
  // Request a street view image from Google

  var promises = [];

  var images = [];
  for (let i = 0; i <= 270; i += 90) {
    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=720x480&location=${lat},${lng}&fov=120&heading=${i}&pitch=10&key=GOOGLE_API_KEY_HERE`;
    images.push(streetViewUrl);
    // Call analyzeImage and save the promise returned by it
    promises.push(new Promise((resolve, reject) => {
      analyzeImage(streetViewUrl, (error, labels) => {
        if (error) {
          console.error(error);
          reject(error);
        } else {
          const labelStrings = labels.map(label => `Label: ${label[0]}, Score: ${label[1]}`);
          const labelString = labelStrings.join("; ");
          resolve(labelString);
        }
      });
    }));
  }

  let i = 0;
  const imageElements = [];
  document.body.style.flexDirection = 'row';
  document.body.style.flexWrap = 'wrap';
  document.body.style.justifyContent = 'baseline';
  document.body.style.alignContent = 'flexStart';
  const imageInterval = setInterval(function () {
    if (i >= images.length - 1) {
      clearInterval(imageInterval);
      document.body.style.flexDirection = 'column';
      document.body.style.flexWrap = 'nowrap'
      document.body.style.justifyContent = 'center';
      document.body.style.alignItems = 'center';
    }
    const streetViewUrl = images[i];
    // console.log(`${streetViewUrl}`)
    const streetViewImg = document.createElement("img");
    streetViewImg.style.height = '25%';
    streetViewImg.src = streetViewUrl;
    document.body.appendChild(streetViewImg);
    imageElements.push(streetViewImg);
    i++;
  }, 750);
  
  
  Promise.all(promises).then(labelStrings => {
    const descriptionString = labelStrings.join("; ");
    // console.log(descriptionString);
  
    fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer OPENAI_API_KEY_HERE`
      },
      body: JSON.stringify({
        'model': 'gpt-3.5-turbo',
        'messages': [{'role': 'user', 'content': `The following text will be labels and their corresponding scores where a higher score means a higher occurrence. Describe the surroundings of this area based on the label and score values without mentioning the values. Your goal is to describe what kind of area this is to a blind person: ${descriptionString}`}],
        'temperature': 0.7
      })
    })
    .then(response => response.json())
    .then(data => {
      clearInterval(imageInterval);
      const loading = document.getElementById("loading");
      loading.style.display = "none";
      const textboxContainer = document.getElementById("output");
      textboxContainer.style.display = "initial";
      const textbox = document.getElementById("output");
      const content = data.choices[0].message.content;
      textbox.textContent = content;
      textboxContainer.setAttribute('aria-label', content);
      textboxContainer.focus();
      imageElements.forEach(function(element) {
        element.style.display="none";
      });
    })
    .catch(error => console.error(error));
  })
  .catch(error => {
    console.error(error);
  });
  
}

function analyzeImage(imageUrl, callback) {
  // console.log(imageUrl);
  
  // Download the image as a blob
  fetch(imageUrl)
    .then(response => response.blob())
    .then(blob => {
      // Create a new FormData object
      const formData = new FormData();

      // Append the blob to the FormData object with the name 'image'
      formData.append('image', blob, 'image.jpg');

      // Encode the blob data as Base64
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = function() {
        const base64data = reader.result.split(',')[1];
        
        // Load the Google API client library
        gapi.client.load('vision', 'v1')
          .then(() => {
            // Make a request to the Vision API to label the image
            return gapi.client.vision.images.annotate({
              requests: [{
                image: {
                  content: base64data,
                },
                features: [{
                  type: 'LABEL_DETECTION',
                  maxResults: 10 // increase the number of results to return
                }]
              }]
            });
          })
          .then(response => {
            // console.log(response)
            // Extract the label annotations from the response
            const labelAnnotations = response.result.responses[0].labelAnnotations;

            // Map the label annotations to an array of tuples containing the label and score
            const labels = labelAnnotations.map(annotation => [annotation.description, annotation.score]);

            // Call the callback function with the array of labels
            callback(null, labels);
          })
          .catch(error => {
            // Call the callback function with the error
            callback(error, null);
          });
      }
    })
    .catch(error => {
      // Call the callback function with the error
      callback(error, null);
    });
}



window.initMap = initMap;
