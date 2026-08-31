const BASE_URL = 'https://join-1ae7f-default-rtdb.europe-west1.firebasedatabase.app/'; // Updated Database

/**
 * Fetches data from a Firebase Realtime Database using the provided path.
 * Returns the parsed JSON data if the request is successful, or `null` if an error occurs.
 *
 * @param {string} [path=''] - The path to the data in the Firebase Realtime Database. Defaults to an empty string.
 * @returns {Promise<Object|null>} A promise that resolves to the fetched data as an object, or `null` if an error occurs.
 */
async function loadData(path = '') {
  try {
    const response = await fetch(BASE_URL + path + '.json');
    if (!response.ok) {
      throw new Error(`HTTP Fehler! Status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error loading data', error);
    return null;
  }
}

/**
 * Sends data to a Firebase Realtime Database using the POST method.
 * Returns the server's response as a JSON object if the request is successful, or `null` if an error occurs.
 *
 * @param {string} [path=''] - The path in the Firebase Realtime Database where the data should be stored. Defaults to an empty string.
 * @param {Object} [data={}] - The data to be sent to the database. Defaults to an empty object.
 * @returns {Promise<Object|null>} A promise that resolves to the server's response as a JSON object, or `null` if an error occurs.
 */
async function postData(path = '', data = {}) {
  try {
    const response = await fetch(BASE_URL + path + '.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    let responseToJson = await response.json();
    return responseToJson;
  } catch (error) {
    console.error('Error in postData', error);
    return null;
  }
}

/**
 * Updates data in a Firebase Realtime Database using the PUT method.
 * Replaces the data at the specified path with the provided data object.
 *
 * @param {string} [path=''] - The path in the Firebase Realtime Database where the data should be updated. Defaults to an empty string.
 * @param {Object} [data={}] - The data to update in the database. Defaults to an empty object.
 * @returns {Promise<Object|null>} A promise that resolves to the server's response as a JSON object, or `null` if an error occurs.
 */
async function updateData(path = '', data = {}) {
  try {
    const response = await fetch(BASE_URL + path + '.json', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    const responseToJson = await response.json();
    return responseToJson;
  } catch (error) {
    console.error('Error updating data', error);
    return null;
  }
}

/**
 * Deletes data from a Firebase Realtime Database using the DELETE method.
 * Removes the data at the specified path and task key.
 *
 * @param {string} [path=''] - The path in the Firebase Realtime Database where the data should be deleted. Defaults to an empty string.
 * @param {string} taskKey - The unique key identifying the specific data to delete.
 * @returns {Promise<Object|null>} A promise that resolves to the server's response as a JSON object if available, or `null` if no response body exists.
 */
async function deleteData(path = '', taskKey) {
  try {
    const response = await fetch(`${BASE_URL}${path}/${taskKey}.json`, {
      method: 'DELETE',
    });
    if (response.headers.get('content-length') !== '0') {
      const responseToJson = await response.json();
      return responseToJson;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error deleting data', error);
  }
}

/**
 * Adds a new color to an existing array in the Firebase Realtime Database.
 * The function retrieves the current data, appends the new color to the specified array, and updates the database.
 *
 * @param {string} key - The key identifying the specific array in the database where the color should be added.
 * @param {string} contactColor - The color value to be added to the array.
 * @returns {Promise<void>} A promise that resolves when the color is successfully added, or logs an error if something goes wrong.
 */
async function addColorToExistingArray(key, contactColor) {
  const path = '/randomColorsJson';
  try {
    const existingData = await loadData(path);
    if (!existingData || !existingData[key]) {
      console.error('Key not found or data is invalid.');
      return;
    }
    existingData[key].push(contactColor);
    await updateData(path, existingData);
  } catch (error) {
    console.error('Error adding color', error);
  }
}

/**
 * 
 * @function fetchAddTask
 * @description Asynchronously loads the header and initializes the logged-in links,
 * then fetches the content of the 'template_add_task.html' file. Upon successful fetch,
 * it inserts the template's content into the HTML element with the ID 'add_task_fetch_template'.
 * If the `parameter` is true, it also calls `setAllPropertysForEditPopup`.
 * It handles potential errors during the fetch process.
 * @param {boolean} [parameter=false] - An optional boolean parameter to trigger additional setup for an edit popup.
 */
async function fetchAddTask(parameter = false) {
  try {
    await loadHeaderAndInitialize();
    await showLoggedInLinks(); 
    fetch('assets/templates/template_add_task.html')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
      })
      .then((data) => {
        document.getElementById('add_task_fetch_template').innerHTML = data;

        if (parameter) {
          setAllPropertysForEditPopup();
        }
      })
      .catch((error) => {
        console.error('Error loading template', error);
      });
  } catch (error) {
    console.error('Unexpected error', error);
  }
}