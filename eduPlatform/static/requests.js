async function getHttpAsync(url) {
    try {
        const response = await fetch(url, { method: 'GET' });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        return await response;
    } catch (error) {
        console.error(`Client request failed: ${error.message}`, error.stack);
        alert(`Client request failed: ${error.message}`);
        return null;
    }
}

async function postHttpAsync(url, data = {}, awaitForResponse = false, callback = () => {}, awaitForJson = true) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken || ""
            },
            body: JSON.stringify(data)
        });

        if (awaitForResponse) {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            if (awaitForJson) {
                const responseData = await response.json();
                callback(responseData);
                return responseData;
            }

            callback({});
        }
    } catch (error) {
        console.error(`Client request failed: ${error.message}`, error.stack);
        alert(`Client request failed: ${error.message}`);
    }
}

async function postFormHttpAsync(url, formData, files = null, awaitForResponse = false, callback = () => {}, awaitForJson = true) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': csrftoken || ""
            }
        });

        if (awaitForResponse) {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            if (awaitForJson) {
                const responseData = await response.json();
                callback(responseData);
                return responseData;
            }

            callback({});
        }
    } catch (error) {
        console.error(`Client request failed: ${error.message}`, error.stack);
        alert(`Client request failed: ${error.message}`);
    }
}