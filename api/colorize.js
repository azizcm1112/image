// api/colorize.js
// This is your serverless function that acts as a proxy to Replicate.com

import fetch from 'node-fetch'; // Vercel supports node-fetch by default

// Replicate API configuration
const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";
// Changed to a different colorization model that is generally available
// This model is specifically for colorization: 'jingyichen/colorization:06528d25d0c008272f254e2071a067098555e105e4b2d8614666f2b7f5255470'
const REPLICATE_MODEL_VERSION_COLORIZE = "jingyichen/colorization:06528d25d0c008272f254e2071a067098555e105e4b2d8614666f2b7f5255470";

// This is the main function that Vercel will execute
export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // Get the API key from environment variables (SECURE WAY)
    const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

    if (!REPLICATE_API_TOKEN) {
        console.error("REPLICATE_API_TOKEN is not set in environment variables.");
        return res.status(500).json({ message: 'Server configuration error: API token missing.' });
    }

    try {
        const { image } = req.body; // Get the image data from the frontend request

        if (!image) {
            return res.status(400).json({ message: 'Image data is required.' });
        }

        // Step 1: Create a prediction request on Replicate
        const predictionResponse = await fetch(REPLICATE_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${REPLICATE_API_TOKEN}`, // Use the secure API token
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                version: REPLICATE_MODEL_VERSION_COLORIZE,
                input: { image: image } // No 'scale' parameter for this colorization model
            })
        });

        if (!predictionResponse.ok) {
            const errorData = await predictionResponse.json();
            console.error("Replicate API Prediction Error:", errorData);
            return res.status(predictionResponse.status).json({
                message: `Failed to create prediction: ${errorData.detail || predictionResponse.statusText}`
            });
        }

        const prediction = await predictionResponse.json();
        let processedImageUrl = null;
        let status = prediction.status;
        let pollUrl = prediction.urls.get;

        // Step 2: Poll the prediction status until it's succeeded or failed
        while (status !== 'succeeded' && status !== 'failed' && status !== 'canceled') {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            const pollResponse = await fetch(pollUrl, {
                headers: {
                    'Authorization': `Token ${REPLICATE_API_TOKEN}`
                }
            });

            if (!pollResponse.ok) {
                const pollErrorData = await pollResponse.json();
                console.error("Replicate API Polling Error:", pollErrorData);
                return res.status(pollResponse.status).json({
                    message: `Failed to poll prediction status: ${pollErrorData.detail || pollResponse.statusText}`
                });
            }

            const pollData = await pollResponse.json();
            status = pollData.status;
            processedImageUrl = pollData.output;
        }

        if (status === 'succeeded' && processedImageUrl) {
            // Send the processed image URL back to the frontend
            res.status(200).json({ processedImageUrl: processedImageUrl });
        } else {
            console.error("Prediction failed or canceled:", status);
            res.status(500).json({ message: `Image processing failed: ${status}` });
        }

    } catch (error) {
        console.error("Serverless function error:", error);
        res.status(500).json({ message: `An unexpected error occurred: ${error.message}` });
    }
}
