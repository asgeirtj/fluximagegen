document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('generatorForm');
    const modelSelect = document.getElementById('model');
    const imageUploadDiv = document.getElementById('imageUploadDiv');
    const imageUpload = document.getElementById('imageUpload');
    const result = document.getElementById('result');
    const spinner = document.getElementById('spinner');
    const log = document.getElementById('log');
    const generateButton = document.getElementById('generateButton');
    const notificationArea = document.getElementById('notificationArea');
    const resetDefaultsButton = document.getElementById('resetDefaults');

    const defaultValues = {
        model: 'text-to-image',
        imageSize: 'square',
        steps: 35,
        guidance: 18,
        numImages: 1,
        seed: ''
    };

    modelSelect.addEventListener('change', () => {
        const selectedModel = modelSelect.value;
        imageUploadDiv.style.display = selectedModel === 'image-to-image' ? 'block' : 'none';
    });

    resetDefaultsButton.addEventListener('click', () => {
        Object.keys(defaultValues).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                element.value = defaultValues[key];
                if (element.type === 'range') {
                    document.getElementById(`${key}Value`).textContent = defaultValues[key];
                }
            }
        });
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await generateImage();
    });

    document.addEventListener('keydown', async function(event) {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            await generateImage();
        }
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
    }

    async function uploadImage(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/upload', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.fileUrl;
    }

    async function sendGenerateRequest(model, input) {
        try {
            console.log('Sending generate request:', { model, input });
            const response = await fetch('/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ model, input }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Received generate response:', data);
            displayResultsAndInfo(data);
        } catch (error) {
            console.error('Error in generateImage:', error);
            log.innerHTML = `Error: ${error.message}`;
        } finally {
            spinner.style.display = 'none';
            notificationArea.style.display = 'none';
        }
    }

    function displayResultsAndInfo(data) {
        result.innerHTML = ''; // Clear previous results
        
        data.images.forEach((image, index) => {
            const imageContainer = document.createElement('div');
            imageContainer.className = 'image-container';
    
            const img = document.createElement('img');
            img.src = image.url;
            img.alt = `Generated Image ${index + 1}`;
    
            const caption = document.createElement('p');
            caption.textContent = `G: ${image.guidanceScale}, S: ${image.inferenceSteps}`;
    
            imageContainer.appendChild(img);
            imageContainer.appendChild(caption);
            
            result.appendChild(imageContainer);
        });

        // Adjust grid layout for 3 images
        if (data.images.length === 3) {
            result.style.gridTemplateColumns = 'repeat(2, 1fr)';
            result.lastElementChild.style.gridColumn = '1 / -1';
        } else {
            result.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
        }
        
        // Scroll to the newly added images
        result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function debounce(func, wait = 100) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    ['steps', 'guidance'].forEach(id => {
        const input = document.getElementById(id);
        const value = document.getElementById(`${id}Value`);
        input.addEventListener('input', debounce(() => {
            value.textContent = input.value;
        }, 50));
    });

    // Initialize range input values
    document.getElementById('stepsValue').textContent = document.getElementById('steps').value;
    document.getElementById('guidanceValue').textContent = document.getElementById('guidance').value;
});