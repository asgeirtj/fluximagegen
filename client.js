console.log('client.js loaded');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded');
    const form = document.getElementById('generatorForm');
    const spinner = document.getElementById('spinner');
    const log = document.getElementById('log');
    const notificationArea = document.getElementById('notificationArea');
    const modelSelect = document.getElementById('model');
    const imageUploadDiv = document.getElementById('imageUploadDiv');
    const imageUpload = document.getElementById('imageUpload');
    const resetDefaultsButton = document.getElementById('resetDefaults');
    const loraWeightsContainer = document.getElementById('loraWeightsContainer');
    const addLoraButton = document.getElementById('addLora');
    const loraWeightsDiv = document.getElementById('loraWeightsDiv');
    const promptInput = document.getElementById('prompt');

    const stepsSlider = document.getElementById('steps');
    const stepsInput = document.getElementById('stepsValue');
    const guidanceSlider = document.getElementById('guidance');
    const guidanceInput = document.getElementById('guidanceValue');
    const numImagesInput = document.getElementById('numImages');
    const decreaseNumImagesButton = document.getElementById('decreaseNumImages');
    const increaseNumImagesButton = document.getElementById('increaseNumImages');

    if (!form || !modelSelect || !loraWeightsContainer || !loraWeightsDiv || !numImagesInput) {
        console.error('One or more required elements not found');
        return;
    }

    // Function to update the display of LoRA weights section
    function toggleLoraWeights() {
        const isFluxLora = modelSelect.value === 'flux-lora';
        loraWeightsDiv.style.display = isFluxLora ? 'block' : 'none';

        const isFluxPro = modelSelect.value === 'flux-pro';
        stepsSlider.parentElement.style.display = isFluxPro ? 'none' : 'block';
        guidanceSlider.parentElement.style.display = isFluxPro ? 'none' : 'block';

        // Toggle required attribute on LoRA inputs
        const loraPathInputs = loraWeightsContainer.querySelectorAll('input[name="lora_path"]');
        const loraScaleInputs = loraWeightsContainer.querySelectorAll('input[name="lora_scale"]');

        if (isFluxLora) {
            loraPathInputs.forEach(input => {
                input.required = true;
                input.disabled = false;
            });
            loraScaleInputs.forEach(input => {
                input.required = true;
                input.disabled = false;
            });
        } else {
            loraPathInputs.forEach(input => {
                input.required = false;
                input.disabled = true;
                input.value = ''; // Optionally clear the input
            });
            loraScaleInputs.forEach(input => {
                input.required = false;
                input.disabled = true;
                input.value = '1'; // Reset to default value
            });
        }

        if (isFluxLora && loraWeightsContainer.children.length === 0) {
            // Add a default LoRA weight input if none exist
            addLoraWeight();
        }
    }

    // Initial call to set correct state on page load
    toggleLoraWeights();

    // Event listener for model selection change
    modelSelect.addEventListener('change', toggleLoraWeights);

    // Event listener for adding LoRA weight
    addLoraButton.addEventListener('click', addLoraWeight);

    // Synchronize steps slider and input
    stepsSlider.addEventListener('input', () => {
        stepsInput.value = stepsSlider.value;
    });

    stepsInput.addEventListener('input', () => {
        stepsSlider.value = stepsInput.value;
    });

    // Synchronize guidance slider and input
    guidanceSlider.addEventListener('input', () => {
        guidanceInput.value = parseFloat(guidanceSlider.value).toFixed(1);
    });

    guidanceInput.addEventListener('input', () => {
        const value = parseFloat(guidanceInput.value);
        if (!isNaN(value) && value >= 1 && value <= 20) {
            guidanceSlider.value = value;
        }
    });

    // Update number of images input
    numImagesInput.addEventListener('input', () => {
        let value = parseInt(numImagesInput.value);
        if (isNaN(value) || value < 1) {
            value = 1;
        } else if (value > 4) {
            value = 4;
        }
        numImagesInput.value = value;
    });

    // Event listeners for custom number input buttons
    decreaseNumImagesButton.addEventListener('click', () => {
        let currentValue = parseInt(numImagesInput.value);
        if (currentValue > 1) {
            numImagesInput.value = currentValue - 1;
        }
    });

    increaseNumImagesButton.addEventListener('click', () => {
        let currentValue = parseInt(numImagesInput.value);
        if (currentValue < 4) {
            numImagesInput.value = currentValue + 1;
        }
    });

    // Event listener for form submission
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        generateImage();
    });

    // Function to fetch and display previous images
    async function fetchAndDisplayPreviousImages() {
        try {
            console.log('Fetching previous images...');
            const response = await fetch('/previous-images');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const images = await response.json();
            if (Array.isArray(images) && images.length > 0) {
                displayPreviousImages(images.slice(0, 20)); // Display only the latest 20 images
            } else {
                console.log('No previous images found');
                const previousImagesDiv = document.getElementById('previousImages');
                if (previousImagesDiv) {
                    previousImagesDiv.innerHTML = '<p>No previous images available.</p>';
                }
            }
        } catch (error) {
            console.error('Error fetching previous images:', error);
            const previousImagesDiv = document.getElementById('previousImages');
            if (previousImagesDiv) {
                previousImagesDiv.innerHTML = '<p>Error loading previous images.</p>';
            }
        }
    }

    // Function to display previous images
    function displayPreviousImages(images) {
        const previousImagesDiv = document.getElementById('previousImages');
        if (!previousImagesDiv) {
            console.error('Previous images div not found');
            return;
        }
        previousImagesDiv.innerHTML = ''; // Clear existing images
        images.forEach(image => {
            const container = document.createElement('div');
            container.classList.add('image-container');

            const img = document.createElement('img');
            img.src = `${image.url}?t=${Date.now()}`; // Add cache-busting query parameter
            img.alt = 'Generated Image';
            img.addEventListener('click', () => enlargeImage(img.src));

            container.appendChild(img);
            previousImagesDiv.appendChild(container);
        });
    }

    // Function to enlarge image
    function enlargeImage(src) {
        const modal = document.createElement('div');
        modal.classList.add('modal');
        modal.innerHTML = `<div class="modal-content"><span class="close">&times;</span><img src="${src}" alt="Enlarged Image"></div>`;
        document.body.appendChild(modal);

        const closeButton = modal.querySelector('.close');
        closeButton.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    // Make sure this function is called when the page loads
    fetchAndDisplayPreviousImages();

    // Function to generate image
    async function generateImage() {
        console.log('generateImage function called at:', new Date().toISOString());

        const formData = new FormData(form);
        const model = formData.get('model');
        const randomSuffix = Math.floor(Math.random() * 1000000);
        const selectedImageSize = formData.get('imageSize');
        const input = {
            prompt: `${formData.get('prompt')} (random:${randomSuffix})`,
            image_size: selectedImageSize,
            num_inference_steps: model === 'flux-pro' ? undefined : parseInt(formData.get('steps')) || 35,
            guidance_scale: model === 'flux-pro' ? undefined : parseFloat(formData.get('guidance')) || 18,
            num_images: parseInt(formData.get('numImages')) || 1,
            seed: formData.get('seed') ? parseInt(formData.get('seed')) : undefined,
        };

        // Add LoRA weights if the model is flux-lora
        if (model === 'flux-lora') {
            input.loras = [];
            const loraWeights = loraWeightsContainer.querySelectorAll('.lora-weight');
            loraWeights.forEach(loraWeight => {
                const path = loraWeight.querySelector('input[name="lora_path"]').value.trim();
                const scale = parseFloat(loraWeight.querySelector('input[name="lora_scale"]').value);
                if (path && !isNaN(scale)) {
                    input.loras.push({ path, scale });
                }
            });
            console.log('LoRA weights (client-side):', input.loras);
        }

        // Clear previous results
        const currentImagesDiv = document.getElementById('currentImages');
        currentImagesDiv.innerHTML = '';

        try {
            spinner.style.display = 'block';
            log.innerHTML = '';
            notificationArea.innerHTML = 'Generating image...';
            notificationArea.style.display = 'block';

            console.log('Processing request with input:', input);

            const response = await fetch('/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ model, input })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Image generation failed: ${errorData.error}`);
            }

            const data = await response.json();
            console.log('Received response:', data);
            displayCurrentImages(data.images);
            fetchAndDisplayPreviousImages();
            notificationArea.style.display = 'none';
            spinner.style.display = 'none';
            log.innerHTML = `Seed: ${data.seed}`;
        } catch (error) {
            console.error('Error generating image:', error);
            notificationArea.innerHTML = `Error generating image: ${error.message}`;
            spinner.style.display = 'none';
        }
    }

    // Function to display current images
    function displayCurrentImages(images) {
        const imageContainer = document.getElementById('currentImages');
        imageContainer.innerHTML = ''; // Clear existing images

        // Create a grid container
        const gridContainer = document.createElement('div');
        gridContainer.style.display = 'grid';
        gridContainer.style.gridGap = '10px'; // Add a small gap between images
        gridContainer.style.justifyContent = 'center'; // Center the grid

        // Set grid template based on number of images
        if (images.length <= 2) {
            gridContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
        } else {
            gridContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
            gridContainer.style.gridTemplateRows = 'repeat(2, auto)';
        }

        images.forEach(image => {
            const imgElement = document.createElement('img');
            imgElement.src = image.url;
            imgElement.alt = 'Generated Image';
            imgElement.style.width = '100%'; // Make image fill its grid cell
            imgElement.style.height = 'auto'; // Maintain aspect ratio

            gridContainer.appendChild(imgElement);
        });

        imageContainer.appendChild(gridContainer);
    }

    // Function to add LoRA weight
    function addLoraWeight() {
        const loraWeightDiv = document.createElement('div');
        loraWeightDiv.className = 'lora-weight';

        const pathInput = document.createElement('input');
        pathInput.type = 'text';
        pathInput.name = 'lora_path';
        pathInput.placeholder = 'LoRA weights path';
        pathInput.required = true;

        const scaleInput = document.createElement('input');
        scaleInput.type = 'number';
        scaleInput.name = 'lora_scale';
        scaleInput.placeholder = 'Scale';
        scaleInput.value = '1';
        scaleInput.step = '0.1';
        scaleInput.min = '0';
        scaleInput.max = '1';
        scaleInput.required = true;

        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.type = 'button';
        removeButton.addEventListener('click', function() {
            loraWeightsContainer.removeChild(loraWeightDiv);
        });

        loraWeightDiv.appendChild(pathInput);
        loraWeightDiv.appendChild(scaleInput);
        loraWeightDiv.appendChild(removeButton);

        loraWeightsContainer.appendChild(loraWeightDiv);
    }

    // Add this new event listener for the prompt textarea
    promptInput.addEventListener('keydown', (event) => {
        // Check if it's Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault(); // Prevent default behavior (new line in textarea)
            generateImage(); // Call the generateImage function
        }
    });
});
