document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('generatorForm');
    const result = document.getElementById('result');
    const spinner = document.getElementById('spinner');
    const log = document.getElementById('log');
    const notificationArea = document.getElementById('notificationArea');
    const modelSelect = document.getElementById('model');
    const imageUploadDiv = document.getElementById('imageUploadDiv');
    const imageUpload = document.getElementById('imageUpload');
    const stepsInput = document.getElementById('steps');
    const stepsValue = document.getElementById('stepsValue');
    const guidanceInput = document.getElementById('guidance');
    const guidanceValue = document.getElementById('guidanceValue');
    const resetDefaultsButton = document.getElementById('resetDefaults');

    modelSelect.addEventListener('change', () => {
        imageUploadDiv.style.display = modelSelect.value === 'image-to-image' ? 'block' : 'none';
    });

    stepsInput.addEventListener('input', () => {
        stepsValue.textContent = stepsInput.value;
    });

    guidanceInput.addEventListener('input', () => {
        guidanceValue.textContent = guidanceInput.value;
    });

    resetDefaultsButton.addEventListener('click', () => {
        stepsInput.value = 35;
        stepsValue.textContent = '35';
        guidanceInput.value = 18;
        guidanceValue.textContent = '18';
        document.getElementById('seed').value = '';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await generateImage();
    });

    async function generateImage() {
        spinner.style.display = 'block';
        log.innerHTML = '';
        notificationArea.innerHTML = 'Generating image...';
        notificationArea.style.display = 'block';
        result.innerHTML = ''; // Clear previous results

        const formData = new FormData(form);
        const model = formData.get('model');
        const randomSuffix = Math.floor(Math.random() * 1000000);
        const input = {
            prompt: `${formData.get('prompt')} (random:${randomSuffix})`,
            image_size: formData.get('imageSize'),
            num_inference_steps: parseInt(formData.get('steps')) || 35,
            guidance_scale: parseFloat(formData.get('guidance')) || 18,
            num_images: parseInt(formData.get('numImages')) || 1,
            seed: formData.get('seed') ? parseInt(formData.get('seed')) : undefined,
            enable_safety_checker: false
        };

        if (model === 'text-to-image-schnell') {
            input.num_inference_steps = Math.min(input.num_inference_steps, 12);
            delete input.guidance_scale;
        }

        if (model === 'image-to-image') {
            if (imageUpload.files.length) {
                const file = imageUpload.files[0];
                input.image_url = await uploadImage(file);
            } else {
                log.innerHTML = 'Please upload an image for Image to Image model.';
                spinner.style.display = 'none';
                notificationArea.style.display = 'none';
                return;
            }
        }
        await sendGenerateRequest(model, input);
        await fetchAndDisplayPreviousImages();
    }

    async function uploadImage(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Image upload failed');
            }

            const data = await response.json();
            return data.fileUrl;
        } catch (error) {
            console.error('Error uploading image:', error);
            throw error;
        }
    }

    async function sendGenerateRequest(model, input) {
        try {
            const response = await fetch('/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ model, input }),
            });

            if (!response.ok) {
                throw new Error('Image generation failed');
            }

            const data = await response.json();
            displayImages(data.images);
            log.innerHTML = `Seed: ${data.seed}`;
        } catch (error) {
            console.error('Error:', error);
            log.innerHTML = `Error: ${error.message}`;
        } finally {
            spinner.style.display = 'none';
            notificationArea.style.display = 'none';
        }
    }

    function displayImages(images) {
        result.innerHTML = ''; // Clear previous results
        images.forEach(image => {
            const container = document.createElement('div');
            container.className = 'image-container';
            const img = document.createElement('img');
            img.src = image.url;
            img.alt = 'Generated Image';
            container.appendChild(img);
            result.appendChild(container);
        });
    }
});

async function fetchAndDisplayPreviousImages() {
    try {
        const response = await fetch('/previous-images');
        const images = await response.json();
        const previousImagesDiv = document.getElementById('previousImages');
        previousImagesDiv.innerHTML = ''; // Clear existing images
        images.forEach(image => {
            const imgElement = document.createElement('img');
            imgElement.src = image.url;
            imgElement.alt = 'Generated Image';
            previousImagesDiv.appendChild(imgElement);
        });
    } catch (error) {
        console.error('Error fetching previous images:', error);
    }
}