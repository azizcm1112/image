// api/colorize.js
// This is your serverless function that acts as a proxy to DeepAI Colorizer API

import fetch from 'node-fetch';

// DeepAI API configuration
const DEEPAI_API_URL = "https://api.deepai.org/api/colorizer"; // DeepAI Colorizer API endpoint

// This is the main function that Vercel will execute
export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // Get the API key from environment variables (SECURE WAY)
    const API_TOKEN = process.env.REPLICATE_API_TOKEN; // Still using this name for consistency

    if (!API_TOKEN) {
        console.error("API_TOKEN is not set in environment variables.");
        return res.status(500).json({ message: 'Server configuration error: API token missing.' });
    }

    try {
        const { image } = req.body; // Get the image data from the frontend request (base64 data URL)

        if (!image) {
            return res.status(400).json({ message: 'Image data is required.' });
        }

        // DeepAI API expects the base64 image data directly, or as a file.
        // For JSON body, it's usually just the base64 string or data URL.
        // We send the full data URL string.
        const deepaiResponse = await fetch(DEEPAI_API_URL, {
            method: 'POST',
            headers: {
                'api-key': API_TOKEN, // CORRECTED: DeepAI uses 'api-key' header for authorization
                'Content-Type': 'application/json', // We are sending JSON body
            },
            body: JSON.stringify({
                image: image // Send the full data URL (e.g., "data:image/jpeg;base64,...")
            })
        });

        if (!deepaiResponse.ok) {
            const errorData = await deepaiResponse.json();
            console.error("DeepAI API Error Response:", errorData);
            // DeepAI often returns errors in an 'err' field
            throw new Error(`DeepAI API Error: ${deepaiResponse.status} - ${errorData.err || deepaiResponse.statusText}`);
        }

        const result = await deepaiResponse.json();
        console.log("DeepAI API Success Response:", result);

        if (result.output_url) { // DeepAI colorizer typically returns 'output_url'
            res.status(200).json({ processedImageUrl: result.output_url });
        } else {
            console.error("DeepAI output_url missing:", result);
            res.status(500).json({ message: 'Failed to get processed image URL from DeepAI.' });
        }

    } catch (error) {
        console.error("Serverless function error:", error);
        res.status(500).json({ message: `An unexpected error occurred: ${error.message}` });
    }
}
