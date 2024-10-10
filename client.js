console.log('client.js loaded');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded');
    const form = document.getElementById('generatorForm');
    const spinner = document.getElementById('spinner');
    const log = document.getElementById('log');
    const notificationArea = document.getElementById('notificationArea');
    const modelSelect = document.getElementById('model');
    const imageInputDiv = document.getElementById('imageInputDiv');
    const imageUpload = document.getElementById('imageUpload');
    const resetDefaultsButton = document.getElementById('resetDefaults');
    const loraWeightsContainer = document.getElementById('loraWeightsContainer');
    const addLoraButton = document.getElementById('addLora');
    const loraWeightsDiv = document.getElementById('loraWeightsDiv');
    const promptInput = document.getElementById('prompt');
    const strengthDiv = document.getElementById('strengthDiv');

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

    // Load saved values from localStorage
    loadSavedValues();

    // Save values to localStorage before unload
    window.addEventListener('beforeunload', saveValues);

    // Function to save values to localStorage
    function saveValues() {
        localStorage.setItem('promptValue', promptInput.value);
        const loraInputs = loraWeightsContainer.querySelectorAll('input[name="lora_path"]');
        const loraValues = Array.from(loraInputs).map(input => input.value);
        localStorage.setItem('loraValues', JSON.stringify(loraValues));
    }

    // Function to load saved values from localStorage
    function loadSavedValues() {
        const savedPrompt = localStorage.getItem('promptValue');
        if (savedPrompt) {
            promptInput.value = savedPrompt;
        }

        const savedLoraValues = JSON.parse(localStorage.getItem('loraValues')) || [];
        savedLoraValues.forEach(value => {
            if (value) {
                addLoraWeight(value);
            }
        });
    }

    // Function to update the display of LoRA weights section
    function toggleModelOptions() {
        const selectedModel = modelSelect.value;
        const isFluxLora = selectedModel === 'flux-lora';
        const isImageToImageOrVideo = selectedModel === 'image-to-image' || selectedModel === 'image-to-video';
        const isFluxPro = selectedModel.startsWith('flux-pro');

        // Toggle LoRA Weights Section
        loraWeightsDiv.style.display = isFluxLora ? 'block' : 'none';

        // Toggle Image Input Section
        imageInputDiv.style.display = isImageToImageOrVideo ? 'block' : 'none';

        // Toggle Strength Section (only for image-to-image)
        strengthDiv.style.display = selectedModel === 'image-to-image' ? 'flex' : 'none';

        // Toggle Steps and Guidance Sliders for Flux Pro models
        if (isFluxPro) {
            stepsSlider.parentElement.style.display = 'none';
            guidanceSlider.parentElement.style.display = 'none';
        } else {
            stepsSlider.parentElement.style.display = 'block';
            guidanceSlider.parentElement.style.display = 'block';
        }

        // Enable or disable LoRA inputs
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
                input.value = '';
            });
            loraScaleInputs.forEach(input => {
                input.required = false;
                input.disabled = true;
                input.value = '1';
            });
        }

        // Automatically add a LoRA weight input if necessary
        if (isFluxLora && loraWeightsContainer.children.length === 0) {
            addLoraWeight();
        }
    }

    // Initial call to set correct state on page load
    toggleModelOptions();

    // Event listener for model selection change
    modelSelect.addEventListener('change', toggleModelOptions);

    // Event listener for adding LoRA weight
    addLoraButton.addEventListener('click', addLoraWeight);

    // Synchronize steps slider and input
    stepsSlider.addEventListener('input', () => {
        stepsInput.value = stepsSlider.value;
    });

    stepsInput.addEventListener('input', () => {
        let value = parseInt(stepsInput.value);
        if (isNaN(value) || value < 1) {
            value = 1;
        } else if (value > 50) {
            value = 50;
        }
        stepsInput.value = value;
        stepsSlider.value = value;
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

    // Implement Queuing Mechanism
    let requestQueue = [];
    let isProcessing = false;

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        requestQueue.push(() => generateImage());
        processQueue();
        
        // Update UI to show that a request has been queued
        notificationArea.innerHTML = `Request queued. ${requestQueue.length} ${requestQueue.length === 1 ? 'request' : 'requests'} in queue.`;
        notificationArea.style.display = 'block';
    });

    async function processQueue() {
        if (isProcessing || requestQueue.length === 0) return;

        isProcessing = true;
        const generateTask = requestQueue.shift();
        await generateTask();
        isProcessing = false;
        processQueue();
    }

    // Function to generate image or video
    async function generateImage() {
        console.log('generateImage function called at:', new Date().toISOString());

        const formData = new FormData(form);
        const model = formData.get('model');
        let input = {
            prompt: formData.get('prompt'),
            image_size: formData.get('imageSize'),
            num_images: parseInt(formData.get('numImages')),
            guidance_scale: parseFloat(formData.get('guidance')),
            num_inference_steps: parseInt(formData.get('steps')),
            seed: formData.get('seed') || undefined,
            enable_safety_checker: false    
        };

        // Collect LoRA weights if the selected model is 'flux-lora'
        if (model === 'flux-lora') {
            const loraPaths = formData.getAll('lora_path');
            const loraScales = formData.getAll('lora_scale');
            const loras = loraPaths.map((path, index) => ({
                path: path.trim(),
                scale: parseFloat(loraScales[index]) || 1
            })).filter(lora => lora.path); // Remove any entries without a path

            input.loras = loras;
        }

        if (model === 'image-to-image' || model === 'image-to-video') {
            if (model === 'image-to-image') {
                input.strength = parseFloat(formData.get('strength')) || 0.95;
            }

            const imageUrl = document.getElementById('imageUrl').value;
            const imageUpload = document.getElementById('imageUpload').files[0];

            if (imageUrl) {
                input.image_url = imageUrl;
            } else if (imageUpload) {
                const uploadFormData = new FormData();
                uploadFormData.append('file', imageUpload);

                try {
                    const uploadResponse = await fetch('/upload', {
                        method: 'POST',
                        body: uploadFormData
                    });

                    if (!uploadResponse.ok) {
                        throw new Error('Failed to upload image');
                    }

                    const uploadResult = await uploadResponse.json();
                    input.image_url = uploadResult.fileUrl;
                } catch (error) {
                    console.error('Error uploading image:', error);
                    notificationArea.innerHTML = `Error uploading image: ${error.message}`;
                    notificationArea.style.display = 'block';
                    spinner.style.display = 'none';
                    return;
                }
            } else {
                notificationArea.innerHTML = 'Please provide an image URL or upload an image for the selected model.';
                notificationArea.style.display = 'block';
                return;
            }
        }

        // Clear previous results
        const currentImagesDiv = document.getElementById('currentImages');
        currentImagesDiv.innerHTML = '';

        try {
            // Remove the spinner display
            // spinner.style.display = 'block';
            log.innerHTML = '';
            notificationArea.innerHTML = `Processing your ${model === 'image-to-video' ? 'video' : 'image'} request...`;
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
                throw new Error(`Request failed: ${errorData.error}`);
            }

            const data = await response.json();
            console.log('Received response:', data);

            if (model === 'image-to-video' && data.video) {
                displayCurrentVideo(data.video);
            } else if (data.images) {
                displayCurrentImages(data.images, input);
            }

            fetchAndDisplayPreviousImages();
            notificationArea.innerHTML = `Generation complete. Seed: ${data.seed}`;
            notificationArea.style.display = 'block';
            // Remove the spinner hide
            // spinner.style.display = 'none';
            log.innerHTML = `Seed: ${data.seed}`;
        } catch (error) {
            console.error('Error generating content:', error);
            notificationArea.innerHTML = `Error: ${error.message}`;
            notificationArea.style.display = 'block';
            // Remove the spinner hide
            // spinner.style.display = 'none';
        }
    }

    // Function to display current images
    function displayCurrentImages(images, inputData) {
        const imageContainer = document.getElementById('currentImages');
        imageContainer.innerHTML = '';

        const gridContainer = document.createElement('div');
        gridContainer.style.display = 'grid';
        gridContainer.style.gridGap = '10px';
        gridContainer.style.justifyContent = 'center';

        if (images.length <= 2) {
            gridContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
        } else {
            gridContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
            gridContainer.style.gridTemplateRows = 'repeat(2, auto)';
        }

        images.forEach((image, index) => {
            const imgElement = document.createElement('img');
            imgElement.src = image.url;
            imgElement.alt = 'Generated Image';
            imgElement.style.width = '100%';
            imgElement.style.height = 'auto';
            imgElement.style.cursor = 'pointer';

            // Store image metadata
            imgElement.dataset.prompt = inputData.prompt;
            imgElement.dataset.imageSize = inputData.image_size;
            imgElement.dataset.numSteps = inputData.num_inference_steps;
            imgElement.dataset.index = index + 1;

            imgElement.addEventListener('click', () => openModal(imgElement));

            gridContainer.appendChild(imgElement);
        });

        imageContainer.appendChild(gridContainer);
    }

    // Function to display current video
    function displayCurrentVideo(video) {
        const videoContainer = document.getElementById('currentImages');
        videoContainer.innerHTML = '';

        const videoElement = document.createElement('video');
        videoElement.src = video.url;
        videoElement.controls = true;
        videoElement.autoplay = true;
        videoElement.loop = true;
        videoElement.style.maxWidth = '100%';
        videoElement.style.height = 'auto';

        videoContainer.appendChild(videoElement);
    }

    // Function to add LoRA weight
    function addLoraWeight(initialValue = '') {
        const loraWeightDiv = document.createElement('div');
        loraWeightDiv.className = 'lora-weight';
        loraWeightDiv.style.display = 'flex';
        loraWeightDiv.style.alignItems = 'center';
        loraWeightDiv.style.marginTop = '10px';

        const pathInput = document.createElement('input');
        pathInput.type = 'text';
        pathInput.name = 'lora_path';
        pathInput.placeholder = 'LoRA weights path';
        pathInput.style.flexGrow = '1';
        pathInput.style.padding = '8px 12px';
        pathInput.style.border = '1px solid #d1d5db';
        pathInput.style.borderRadius = '6px';
        pathInput.value = initialValue;

        const scaleInput = document.createElement('input');
        scaleInput.type = 'number';
        scaleInput.name = 'lora_scale';
        scaleInput.placeholder = 'Scale';
        scaleInput.value = '1';
        scaleInput.step = '0.1';
        scaleInput.min = '0';
        scaleInput.max = '10';
        scaleInput.style.width = '80px';
        scaleInput.style.marginLeft = '10px';
        scaleInput.style.padding = '8px 12px';
        scaleInput.style.border = '1px solid #d1d5db';
        scaleInput.style.borderRadius = '6px';

        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.type = 'button';
        removeButton.style.marginLeft = '10px';
        removeButton.style.backgroundColor = '#ef4444';
        removeButton.style.color = '#ffffff';
        removeButton.style.border = 'none';
        removeButton.style.padding = '8px 12px';
        removeButton.style.borderRadius = '6px';
        removeButton.style.cursor = 'pointer';
        removeButton.style.transition = 'background-color 0.2s ease';

        removeButton.addEventListener('mouseover', () => {
            removeButton.style.backgroundColor = '#dc2626';
        });
        removeButton.addEventListener('mouseout', () => {
            removeButton.style.backgroundColor = '#ef4444';
        });

        removeButton.addEventListener('click', () => {
            loraWeightsContainer.removeChild(loraWeightDiv);
        });

        loraWeightDiv.appendChild(pathInput);
        loraWeightDiv.appendChild(scaleInput);
        loraWeightDiv.appendChild(removeButton);

        loraWeightsContainer.appendChild(loraWeightDiv);
    }

    // Reset to Defaults
    resetDefaultsButton.addEventListener('click', () => {
        form.reset();
        stepsSlider.value = 35;
        stepsInput.value = 35;
        guidanceSlider.value = 18;
        guidanceInput.value = 18;
        numImagesInput.value = 1;
        loraWeightsContainer.innerHTML = '';
        imageInputDiv.style.display = 'none';
        strengthDiv.style.display = 'none';
        toggleModelOptions(); // Ensure the UI updates correctly
    });

    // Add this new event listener for the prompt textarea
    promptInput.addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            generateImage();
        }
    });

    // Add event listeners for file input and URL input
    document.getElementById('imageUpload').addEventListener('change', function() {
        document.getElementById('imageUrl').value = '';
    });

    document.getElementById('imageUrl').addEventListener('input', function() {
        document.getElementById('imageUpload').value = '';
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
                displayPreviousImages(images.slice(0, 20));
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
        previousImagesDiv.innerHTML = '';
        images.forEach((image, index) => {
            const container = document.createElement('div');
            container.classList.add('image-container');

            const mediaElement = document.createElement(image.content_type.startsWith('video') ? 'video' : 'img');
            mediaElement.src = `${image.url}?t=${Date.now()}`;
            mediaElement.alt = 'Generated Content';
            if (image.content_type.startsWith('video')) {
                mediaElement.controls = true;
                mediaElement.autoplay = true;
                mediaElement.loop = true;
                mediaElement.style.maxWidth = '100%';
                mediaElement.style.height = 'auto';
            } else {
                mediaElement.style.width = '100%';
                mediaElement.style.height = 'auto';
                mediaElement.style.cursor = 'pointer';
                
                // Store image metadata (if available)
                if (image.metadata) {
                    mediaElement.dataset.prompt = image.metadata.prompt || 'N/A';
                    mediaElement.dataset.imageSize = image.metadata.image_size || 'N/A';
                    mediaElement.dataset.numSteps = image.metadata.num_inference_steps || 'N/A';
                }
                mediaElement.dataset.index = index + 1;

                mediaElement.addEventListener('click', () => openModal(mediaElement));
            }

            container.appendChild(mediaElement);
            previousImagesDiv.appendChild(container);
        });
    }

    // Image gallery functionality
    const modal = document.getElementById('imageModal');
    const modalImg = modal.querySelector('img');
    const closeBtn = modal.querySelector('.close');
    const leftArrow = document.createElement('div');
    const rightArrow = document.createElement('div');

    leftArrow.classList.add('gallery-arrow', 'left-arrow');
    rightArrow.classList.add('gallery-arrow', 'right-arrow');
    leftArrow.innerHTML = '&#10094;';
    rightArrow.innerHTML = '&#10095;';

    modal.appendChild(leftArrow);
    modal.appendChild(rightArrow);

    let currentImageIndex = 0;
    let galleryImages = [];

    function openModal(img) {
        modal.style.display = 'flex';
        modalImg.src = img.src;
        document.body.style.overflow = 'hidden';

        // Display image information
        const infoDiv = document.createElement('div');
        infoDiv.classList.add('image-info');
        infoDiv.innerHTML = `
            <p><strong>Prompt:</strong> ${img.dataset.prompt || 'N/A'}</p>
            <p><strong>Image Size:</strong> ${img.dataset.imageSize || 'N/A'}</p>
            <p><strong>Inference Steps:</strong> ${img.dataset.numSteps || 'N/A'}</p>
            <p><strong>Image:</strong> ${img.dataset.index} of ${galleryImages.length}</p>
        `;
        modal.querySelector('.modal-content').appendChild(infoDiv);

        const allImages = document.querySelectorAll('#currentImages img, #previousImages img');
        galleryImages = Array.from(allImages);
        currentImageIndex = galleryImages.indexOf(img);

        updateArrowVisibility();
    }

    function closeModal() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        // Remove the image info div
        const infoDiv = modal.querySelector('.image-info');
        if (infoDiv) {
            infoDiv.remove();
        }
    }

    function navigateGallery(direction) {
        currentImageIndex += direction;
        if (currentImageIndex < 0) currentImageIndex = galleryImages.length - 1;
        if (currentImageIndex >= galleryImages.length) currentImageIndex = 0;

        const newImg = galleryImages[currentImageIndex];
        modalImg.src = newImg.src;

        // Update image information
        const infoDiv = modal.querySelector('.image-info');
        infoDiv.innerHTML = `
            <p><strong>Prompt:</strong> ${newImg.dataset.prompt || 'N/A'}</p>
            <p><strong>Image Size:</strong> ${newImg.dataset.imageSize || 'N/A'}</p>
            <p><strong>Inference Steps:</strong> ${newImg.dataset.numSteps || 'N/A'}</p>
            <p><strong>Image:</strong> ${newImg.dataset.index} of ${galleryImages.length}</p>
        `;

        updateArrowVisibility();
    }

    function updateArrowVisibility() {
        leftArrow.style.display = galleryImages.length > 1 ? 'block' : 'none';
        rightArrow.style.display = galleryImages.length > 1 ? 'block' : 'none';
    }

    closeBtn.onclick = closeModal;
    leftArrow.onclick = () => navigateGallery(-1);
    rightArrow.onclick = () => navigateGallery(1);

    modal.onclick = (event) => {
        if (event.target === modal) closeModal();
    };

    // Add keyboard navigation
    document.addEventListener('keydown', (event) => {
        if (modal.style.display === 'flex') {
            switch (event.key) {
                case 'ArrowLeft':
                    navigateGallery(-1);
                    break;
                case 'ArrowRight':
                    navigateGallery(1);
                    break;
                case 'Escape':
                    closeModal();
                    break;
            }
        }
    });

    // Global Cmd+Enter or Ctrl+Enter handler
    document.addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            form.dispatchEvent(new Event('submit'));
        }
    });

    // Make sure this function is called when the page loads
    fetchAndDisplayPreviousImages();
});