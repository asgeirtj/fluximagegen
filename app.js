const express = require('express');
const bodyParser = require('body-parser');
const fal = require('@fal-ai/serverless-client');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const sharp = require('sharp');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configure the FAL client with your API key
fal.config({
    credentials: process.env.FAL_KEY
});

// Middleware to parse incoming JSON requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware for handling file uploads
const upload = multer({ dest: 'uploads/' });

// Serve static files from the current directory
app.use(express.static(__dirname));

// Create saved_images directory if it doesn't exist
const savedImagesDir = path.join(__dirname, 'saved_images');
fs.mkdir(savedImagesDir, { recursive: true }).catch(console.error);

// Model mapping
const modelMap = {
    'flux-pro': 'fal-ai/flux-pro',
    'text-to-image': 'fal-ai/flux/dev',
    'image-to-image': 'fal-ai/flux/dev/image-to-image',
    'text-to-image-schnell': 'fal-ai/flux/schnell',
    'sdxl': 'fal-ai/lora'
};

app.post('/generate', async (req, res) => {
    try {
        const { model, input } = req.body;
        console.log('Received generate request:', { model, input, seed: input.seed });

        const falModel = modelMap[model];
        if (!falModel) {
            throw new Error(`Invalid model: ${model}`);
        }

        // Adjust input parameters based on the model
        const adjustedInput = adjustInputForModel(model, input);

        const result = await fal.subscribe(falModel, {
            input: adjustedInput,
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === "IN_PROGRESS") {
                    update.logs.map((log) => log.message).forEach(console.log);
                }
            }
        });

        console.log('Generation result:', result);

        // Save images with guidance scale and inference steps
        const savedImages = await saveImages(
            result.images, 
            input.prompt, 
            adjustedInput.guidance_scale, 
            adjustedInput.num_inference_steps
        );

        res.json({
            images: savedImages,
            seed: result.seed
        });
    } catch (error) {
        console.error('Error in /generate:', error);
        res.status(500).json({ error: error.message });
    }
});


function adjustInputForModel(model, input) {
    const adjustedInput = { ...input };

    if (input.image_size) {
        adjustedInput.image_size = input.image_size.replace('x', '_');
    }

    // Set default values for all models
    adjustedInput.num_inference_steps = adjustedInput.num_inference_steps || 35;
    adjustedInput.guidance_scale = adjustedInput.guidance_scale || 2;
    adjustedInput.num_images = adjustedInput.num_images || 1;

    // Add a random seed if not provided
    if (!adjustedInput.seed) {
        adjustedInput.seed = Math.floor(Math.random() * 1000000000);
    }

    switch (model) {
        case 'flux-pro':
            adjustedInput.safety_tolerance = "6"; // Most permissive setting
            break;
        case 'text-to-image':
            adjustedInput.enable_safety_checker = false;
            break;
        case 'image-to-image':
            adjustedInput.enable_safety_checker = false;
            adjustedInput.strength = adjustedInput.strength || 0.95;
            break;
        case 'text-to-image-schnell':
            adjustedInput.enable_safety_checker = false;
            adjustedInput.num_inference_steps = Math.min(adjustedInput.num_inference_steps || 12, 12);
            delete adjustedInput.guidance_scale;
            break;
        case 'sdxl':
            adjustedInput.model_name = "stabilityai/stable-diffusion-xl-base-1.0";
            break;
    }

    return adjustedInput;
}

async function saveImages(images, prompt, guidanceScale, inferenceSteps) {
    const savedImages = [];
    for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const fileName = `${prompt.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_gs${guidanceScale}_steps${inferenceSteps}_${i + 1}.png`;
        const filePath = path.join(savedImagesDir, fileName);
        
        const response = await axios.get(image.url, { responseType: 'arraybuffer' });
        
        // Convert to PNG using Sharp
        await sharp(response.data)
            .png()
            .toFile(filePath);
        
        savedImages.push({
            url: `/saved_images/${fileName}`,
            content_type: 'image/png'
        });
    }
    return savedImages;
}


// Endpoint to handle file uploads
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        const filePath = path.join(__dirname, 'uploads', file.filename);
        
        // Optionally, you can upload the file to a cloud storage service and return the URL
        const fileUrl = `http://localhost:${port}/uploads/${file.filename}`;
        
        res.json({ fileUrl });
    } catch (error) {
        console.error('Error in /upload:', error);
        res.status(500).json({ error: error.message });
    }
});

// Serve uploaded files and saved images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/saved_images', express.static(savedImagesDir));

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
