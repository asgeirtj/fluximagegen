# fluximagegen

Fluximagegen is a web-based AI image generation tool that leverages various AI models to create images from text prompts or modify existing images. This application provides a user-friendly interface for interacting with different image generation models, including Flux and its variants.

## Features

- Support for multiple AI models:
  - Flux Reference
  - Text to Image [dev] FLUX.1
  - [pro] FLUX 1.1 [pro]
  - Image to Image [dev]
  - Text to Image [schnell]
  - FLUX.1 Lora
- Customizable image generation parameters:
  - Prompt input
  - Image size selection
  - Number of inference steps
  - Guidance scale
  - Number of images to generate
  - Optional seed for reproducibility
- LoRA (Low-Rank Adaptation) support for the FLUX.1 Lora model
- Image upload capability for image-to-image generation
- Real-time display of generated images
- Gallery of previously generated images
- Responsive design for both desktop and mobile devices

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/fluximagegen.git
   cd fluximagegen
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add your FAL AI key:
   ```
   FAL_KEY=your_fal_ai_key_here
   ```

4. Start the server:
   ```
   node app.js
   ```

5. Open a web browser and navigate to `http://localhost:3000` (or the port specified in your environment).

## Usage

1. Select an AI model from the dropdown menu.
2. Enter a text prompt describing the image you want to generate.
3. Adjust the image size, number of inference steps, guidance scale, and number of images as desired.
4. For the FLUX.1 Lora model, add LoRA weights if needed.
5. Optionally, enter a seed for reproducible results.
6. Click "Generate Image" or press CMD+Enter (or Ctrl+Enter) to create the image(s).
7. View the generated images in the right panel.
8. Browse previously generated images in the gallery below.

## Contributing

Contributions to fluximagegen are welcome! Please feel free to submit pull requests, create issues or spread the word.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- FAL AI for providing the image generation models
- All contributors and users of this project
