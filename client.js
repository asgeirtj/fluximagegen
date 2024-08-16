document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('generatorForm');
    const modelSelect = document.getElementById('model');
    const imageUploadDiv = document.getElementById('imageUploadDiv');
    const dropZone = document.getElementById('dropZone');
    const imageUpload = document.getElementById('imageUpload');
    const result = document.getElementById('result');
    const spinner = document.getElementById('spinner');
    const log = document.getElementById('log');
    const generateButton = document.getElementById('generateButton');

    // Update UI based on selected model
    modelSelect.addEventListener('change', () => {
        const selectedModel = modelSelect.value;
        imageUploadDiv.style.display = selectedModel === 'image-to-image' ? 'block' : 'none';
    });

    // Handle file drop and selection
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            imageUpload.files = e.dataTransfer.files;
            dropZone.textContent = e.dataTransfer.files[0].name;
        }
    });

    dropZone.addEventListener('click', () => {
        imageUpload.click();
    });

    imageUpload.addEventListener('change', () => {
        if (imageUpload.files.length) {
            dropZone.textContent = imageUpload.files[0].name;
        }
    });

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        generateImage();
    });

    // You can also add a click event listener to the button if you prefer
    generateButton.addEventListener('click', (e) => {
        e.preventDefault();
        generateImage();
    });

    async function generateImage() {
        spinner.style.display = 'block';
        result.innerHTML = '';
        log.innerHTML = '';

        const formData = new FormData(form);
        const model = formData.get('model');
        const randomSuffix = Math.floor(Math.random() * 1000000);
        const input = {
            prompt: `${formData.get('prompt')} (random:${randomSuffix})`,
            image_size: formData.get('imageSize'),
            num_inference_steps: parseInt(formData.get('steps')) || 35,
            guidance_scale: parseFloat(formData.get('guidance')) || 18,
            num_images: parseInt(formData.get('numImages')) || 4,
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
                const reader = new FileReader();
                reader.onload = async (event) => {
                    input.image_url = await uploadImage(file);
                    await sendGenerateRequest(model, input);
                };
                reader.readAsDataURL(file);
            } else {
                log.innerHTML = 'Please upload an image for Image to Image model.';
                spinner.style.display = 'none';
            }
        } else {
            await sendGenerateRequest(model, input);
        }
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
            displayResults(data);
        } catch (error) {
            console.error('Error in generateImage:', error);
            log.innerHTML = `Error: ${error.message}`;
        } finally {
            spinner.style.display = 'none';
        }
    }

    function displayResults(data) {
        result.innerHTML = '';
        data.images.forEach((image, index) => {
            const img = document.createElement('img');
            img.src = image.url;
            img.alt = `Generated Image ${index + 1}`;
            result.appendChild(img);
        });
        log.innerHTML = `Seed used: ${data.seed}`;
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
        }, 50)); // Adjust the debounce delay as needed
    });
    

    // Ensure the initial values are displayed correctly when the page loads
    window.addEventListener('DOMContentLoaded', () => {
        const stepsInput = document.getElementById('steps');
        const guidanceInput = document.getElementById('guidance');

        document.getElementById('stepsValue').textContent = stepsInput.value;
        document.getElementById('guidanceValue').textContent = guidanceInput.value;
    });
});
