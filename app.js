// File: app.js

const express = require('express');
const bodyParser = require('body-parser');
const fal = require('@fal-ai/serverless-client');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const sharp = require('sharp');
const mime = require('mime-types');
require('dotenv').config();

const app = express();
let port = process.env.PORT || 3000;

// Function to find an available port
function findAvailablePort(startPort) {
    return new Promise((resolve, reject) => {
        const server = app.listen(startPort, () => {
            server.close(() => {
                resolve(startPort);
            });
        }).on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(findAvailablePort(startPort + 1));
            } else {
                reject(err);
            }
        });
    });
}

// Configure FAL client with your API key
fal.config({
    credentials: process.env.FAL_KEY
});

// Middleware to parse JSON and URL-encoded data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configure multer to preserve original file extensions
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const timestamp = Date.now();
        const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '');
        cb(null, `${timestamp}-${sanitizedFilename}`);
    }
});

const upload = multer({ storage: storage });

// Serve static files from the current directory
app.use(express.static(__dirname));

// Ensure the 'saved_images' and 'uploads' directories exist
const savedImagesDir = path.join(__dirname, 'saved_images');
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdir(savedImagesDir, { recursive: true }).catch(console.error);
fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);

// Map of model names to their respective API endpoints
const modelMap = {
    'flux-reference': 'fal-ai/flux-reference',
    'text-to-image': 'fal-ai/flux/dev',
    'text-to-image-schnell': 'fal-ai/flux/schnell',
    'flux-pro': 'fal-ai/flux-pro',
    'flux-pro-v1.1': 'fal-ai/flux-pro/v1.1',
    'flux-pro-new': 'fal-ai/flux-pro/new',
    'flux-lora': 'fal-ai/flux-lora',
    'image-to-image': 'fal-ai/flux/dev/image-to-image',
    'image-to-video': 'fal-ai/runway-gen3/turbo/image-to-video'
};

// POST /generate endpoint to handle image and video generation requests
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
        console.log('Adjusted input for model:', model, adjustedInput);

        // Handle image_url for image-to-image and image-to-video
        if ((model === 'image-to-image' || model === 'image-to-video') && adjustedInput.image_url) {
            if (adjustedInput.image_url.startsWith(`http://localhost:${port}`)) {
                const localFilePath = path.join(__dirname, adjustedInput.image_url.replace(`http://localhost:${port}`, ''));

                try {
                    await fs.access(localFilePath);
                    console.log(`File exists: ${localFilePath}`);

                    const fileData = await fs.readFile(localFilePath);
                    const uploadedFile = await fal.storage.upload(fileData, path.basename(localFilePath));
                    
                    if (typeof uploadedFile === 'string' && uploadedFile.startsWith('http')) {
                        adjustedInput.image_url = uploadedFile;
                        console.log('Uploaded image URL:', adjustedInput.image_url);
                    } else {
                        throw new Error('Unexpected response format from FAL upload.');
                    }
                } catch (uploadError) {
                    console.error('Error uploading file to FAL:', uploadError);
                    throw new Error('Failed to upload image to FAL: ' + uploadError.message);
                }
            }
        } else if (model === 'image-to-image' || model === 'image-to-video') {
            throw new Error(`image_url is required for ${model} model`);
        }

        console.log('Final input before API call:', adjustedInput);

        // Subscribe to the FAL model
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

        if (result.video) {
            const savedVideo = await saveVideo(result.video, input.prompt);
            res.json({
                video: savedVideo,
                seed: result.seed
            });
        } else if (result.images) {
            const savedImages = await saveImages(
                result.images.slice(0, adjustedInput.num_images),
                input.prompt,
                adjustedInput.image_size,
                adjustedInput.num_inference_steps,
                result.seed
            );

            res.json({
                images: savedImages,
                seed: result.seed
            });
        } else {
            throw new Error('Unexpected result format');
        }
    } catch (error) {
        console.error('Error in content generation:', error);
        if (error.body) {
            console.error('Error body:', error.body);
        }
        res.status(500).json({ error: error.message, body: error.body });
    }
});

// Function to adjust input parameters based on the selected model
function adjustInputForModel(model, input) {
    let adjustedInput = { ...input };

    switch (model) {
        case 'flux-pro':
            adjustedInput = {
                prompt: input.prompt,
                image_size: input.image_size || 'landscape_4_3',
                num_images: Math.min(Math.max(parseInt(input.num_images) || 1, 1), 4),
                guidance_scale: parseFloat(input.guidance_scale) || 7.5,
                num_inference_steps: parseInt(input.num_inference_steps) || 40,
                seed: input.seed ? parseInt(input.seed) : undefined,
                safety_tolerance: "6",
                enable_safety_checker: input.enable_safety_checker !== undefined ? input.enable_safety_checker : false
            };
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
            // Keep only the supported parameters for image-to-image
            adjustedInput = {
                image_url: input.image_url,
                prompt: input.prompt,
                strength: parseFloat(input.strength) || 0.95,
                image_size: input.image_size || 'landscape_4_3',
                num_inference_steps: parseInt(input.num_inference_steps) || 40,
                seed: input.seed ? parseInt(input.seed) : undefined,
                guidance_scale: parseFloat(input.guidance_scale) || 3.5,
                num_images: Math.min(Math.max(parseInt(input.num_images) || 1, 1), 4),
                enable_safety_checker: input.enable_safety_checker !== undefined ? input.enable_safety_checker : false
            };
            break;
        case 'image-to-video':
            // Adjust the input for image-to-video
            adjustedInput = {
                prompt: input.prompt,
                image_url: input.image_url,
                duration: input.duration || "5"
            };
            // Ensure duration is a string
            adjustedInput.duration = adjustedInput.duration.toString();
            break;
    }

    console.log('Adjusted input:', adjustedInput);
    return adjustedInput;
}

// Function to save generated images
async function saveImages(images, prompt, imageSize, inferenceSteps, seed) {
    const savedImages = [];
    for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const truncatedPrompt = prompt.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20);
        const timestamp = Date.now();
        const fileName = `${truncatedPrompt}_${imageSize}_s${inferenceSteps}_${timestamp}_${i + 1}.png`;
        const filePath = path.join(savedImagesDir, fileName);

        try {
            const response = await axios.get(image.url, { responseType: 'arraybuffer' });

            await sharp(response.data)
                .png()
                .toFile(filePath);

            const metadata = {
                prompt: prompt,
                image_size: imageSize,
                num_inference_steps: inferenceSteps,
                seed: seed
            };

            await fs.writeFile(`${filePath}.json`, JSON.stringify(metadata));

            savedImages.push({
                url: `/saved_images/${fileName}`,
                content_type: 'image/png',
                metadata: metadata
            });
        } catch (error) {
            console.error(`Error saving image ${fileName}:`, error);
        }
    }
    return savedImages;
}

// Function to save generated videos
async function saveVideo(video, prompt) {
    const truncatedPrompt = prompt.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20);
    const timestamp = Date.now();
    const fileName = `${truncatedPrompt}_${timestamp}.mp4`;
    const filePath = path.join(savedImagesDir, fileName);

    try {
        const response = await axios.get(video.url, { responseType: 'arraybuffer' });

        await fs.writeFile(filePath, response.data);

        return {
            url: `/saved_images/${fileName}`,
            content_type: 'video/mp4'
        };
    } catch (error) {
        console.error(`Error saving video ${fileName}:`, error);
        throw error;
    }
}

// POST /upload endpoint to handle image uploads
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            throw new Error('No file uploaded');
        }
        const fileUrl = `http://localhost:${port}/uploads/${file.filename}`;
        res.json({ fileUrl });
    } catch (error) {
        console.error('Error in /upload:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /previous-images endpoint to fetch previously generated images and videos
app.get('/previous-images', async (req, res) => {
    try {
        const files = await fs.readdir(savedImagesDir);
        const filePromises = files.filter(file => !file.endsWith('.json')).map(async file => {
            const filePath = path.join(savedImagesDir, file);
            const stats = await fs.stat(filePath);
            const ext = path.extname(file).toLowerCase();
            let content_type = 'image/png';
            if (ext === '.mp4') {
                content_type = 'video/mp4';
            } else {
                content_type = mime.lookup(ext) || 'application/octet-stream';
            }

            let metadata = {};
            try {
                const metadataContent = await fs.readFile(`${filePath}.json`, 'utf-8');
                metadata = JSON.parse(metadataContent);
            } catch (error) {
                console.error(`Error reading metadata for ${file}:`, error);
            }

            return {
                url: `/saved_images/${file}`,
                createdAt: stats.birthtime,
                content_type: content_type,
                metadata: metadata
            };
        });
        let filesInfo = await Promise.all(filePromises);
        filesInfo.sort((a, b) => b.createdAt - a.createdAt);
        filesInfo = filesInfo.slice(0, 50);
        res.json(filesInfo);
    } catch (error) {
        console.error('Error fetching previous files:', error);
        res.status(500).json({ error: error.message });
    }
});

// Serve static files from the 'uploads' and 'saved_images' directories
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/saved_images', express.static(savedImagesDir));

// Start the server
findAvailablePort(port).then((availablePort) => {
    port = availablePort;
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
}).catch((err) => {
    console.error('Failed to find an available port:', err);
});