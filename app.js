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

    adjustedInput.num_inference_steps = adjustedInput.num_inference_steps || 35;
    adjustedInput.guidance_scale = adjustedInput.guidance_scale || 2;
    adjustedInput.num_images = adjustedInput.num_images || 1;

    if (!adjustedInput.seed) {
        adjustedInput.seed = Math.floor(Math.random() * 1000000000);
    }

    switch (model) {
        case 'flux-pro':
            adjustedInput.safety_tolerance = "6";
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
        const truncatedPrompt = prompt.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20);
        const fileName = `${truncatedPrompt}_g${guidanceScale}_s${inferenceSteps}_${i + 1}.png`;
        const filePath = path.join(savedImagesDir, fileName);
        
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
        const images = files.map(file => ({
            url: `/saved_images/${file}`
        }));
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
