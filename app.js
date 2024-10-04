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

fal.config({
    credentials: process.env.FAL_KEY
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const upload = multer({ dest: 'uploads/' });

app.use(express.static(__dirname));

const savedImagesDir = path.join(__dirname, 'saved_images');
fs.mkdir(savedImagesDir, { recursive: true }).catch(console.error);

const modelMap = {
    'flux-pro': 'fal-ai/flux-pro/v1.1',
    'text-to-image': 'fal-ai/flux/dev',
    'image-to-image': 'fal-ai/flux/dev/image-to-image',
    'text-to-image-schnell': 'fal-ai/flux/schnell',
    'flux-lora': 'fal-ai/flux-lora',
    'flux-reference': 'fal-ai/flux-reference'
};

app.post('/generate', async (req, res) => {
    console.log('Received /generate request');
    const { model, input } = req.body;
    console.log('Request body:', { model, input });

    try {
        const falModel = modelMap[model];
        if (!falModel) {
            throw new Error(`Invalid model: ${model}`);
        }

        const adjustedInput = adjustInputForModel(model, input);
        console.log('Adjusted input:', adjustedInput);

        // Ensure LoRA weights are passed correctly for flux-lora model
        if (model === 'flux-lora' && adjustedInput.loras && adjustedInput.loras.length > 0) {
            console.log('Using LoRA weights (server-side):', adjustedInput.loras);
        }

        // Only remove num_inference_steps and guidance_scale for flux-pro
        if (model === 'flux-pro') {
            delete adjustedInput.num_inference_steps;
            delete adjustedInput.guidance_scale;
        }

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
        console.log('Number of images returned by API:', result.images.length);

        const savedImages = await saveImages(
            result.images.slice(0, adjustedInput.num_images),
            input.prompt,
            adjustedInput.guidance_scale,
            adjustedInput.num_inference_steps
        );

        res.json({
            images: savedImages,
            seed: result.seed
        });
    } catch (error) {
        console.error('Error in image generation:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

function adjustInputForModel(model, input) {
    const adjustedInput = { ...input, enable_safety_checker: false };

    adjustedInput.num_images = Math.min(Math.max(parseInt(input.num_images) || 1, 1), 4);

    switch (model) {
        case 'flux-pro':
            adjustedInput.safety_tolerance = "6";
            break;
        case 'text-to-image-schnell':
            adjustedInput.num_inference_steps = Math.min(adjustedInput.num_inference_steps || 35, 12);
            delete adjustedInput.guidance_scale;
            break;
        case 'flux-lora':
            adjustedInput.loras = (input.loras || []).map(lora => ({
                path: lora.path.trim(),
                scale: parseFloat(lora.scale) || 1
            })).filter(lora => lora.path);
            console.log('LoRA weights (after adjustment):', adjustedInput.loras);
            break;
        case 'image-to-image':
            adjustedInput.strength = adjustedInput.strength || 0.95;
            break;
    }

    adjustedInput.enable_safety_checker = false;

    console.log('Adjusted input for model:', model, adjustedInput);
    return adjustedInput;
}

async function saveImages(images, prompt, guidanceScale, inferenceSteps) {
    const savedImages = [];
    for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const truncatedPrompt = prompt.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20);
        const timestamp = Date.now();
        const fileName = `${truncatedPrompt}_g${guidanceScale}_s${inferenceSteps}_${timestamp}_${i + 1}.png`;
        const filePath = path.join(savedImagesDir, fileName);

        try {
            const response = await axios.get(image.url, { responseType: 'arraybuffer' });

            await sharp(response.data)
                .png()
                .toFile(filePath);

            savedImages.push({
                url: `/saved_images/${fileName}`,
                content_type: 'image/png',
                guidanceScale: guidanceScale,
                inferenceSteps: inferenceSteps
            });
        } catch (error) {
            console.error(`Error saving image ${fileName}:`, error);
        }
    }
    return savedImages;
}

app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        const fileUrl = `http://localhost:${port}/uploads/${file.filename}`;
        res.json({ fileUrl });
    } catch (error) {
        console.error('Error in /upload:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/previous-images', async (req, res) => {
    try {
        const files = await fs.readdir(savedImagesDir);
        const imagePromises = files.map(async file => {
            const filePath = path.join(savedImagesDir, file);
            const stats = await fs.stat(filePath);
            return {
                url: `/saved_images/${file}`,
                createdAt: stats.birthtime
            };
        });
        let images = await Promise.all(imagePromises);
        // Sort images by creation time, most recent first
        images.sort((a, b) => b.createdAt - a.createdAt);
        // Limit the number of images sent to the client
        images = images.slice(0, 50); // Adjust the number as needed
        res.json(images);
    } catch (error) {
        console.error('Error fetching previous images:', error);
        res.status(500).json({ error: error.message });
    }
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/saved_images', express.static(savedImagesDir));

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
