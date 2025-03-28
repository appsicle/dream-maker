document.getElementById('promptForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const prompt = document.getElementById('prompt').value;
    const generateVideos = document.getElementById('generateVideos').checked;
    const submitButton = document.querySelector('button[type="submit"]');
    const resultsContainer = document.getElementById('results');
    
    // Clear previous results
    resultsContainer.innerHTML = '';
    
    // Disable submit button and show loading state
    submitButton.disabled = true;
    submitButton.textContent = 'Generating...';
    
    try {
        const response = await fetch('/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt,
                generateVideos
            }),
        });
        
        const data = await response.json();
        
        console.log('✅ Received response:', data);

        if (!response.ok) {
            throw new Error(data.error || 'Failed to generate variations');
        }
        
        // Display the base prompt
        const basePromptDiv = document.createElement('div');
        basePromptDiv.className = 'base-prompt';
        basePromptDiv.innerHTML = `
            <h3>Expanded Prompt:</h3>
            <p>${data.basePrompt}</p>
            <h4>Aspects to Vary:</h4>
            <ul>
                ${data.aspects.map(aspect => `<li>${aspect}</li>`).join('')}
            </ul>
        `;
        resultsContainer.appendChild(basePromptDiv);

        // Display variations
        data.results.forEach((result, index) => {
            const variationDiv = document.createElement('div');
            variationDiv.className = 'variation';
            
            const content = `
                <h3>Variation ${index + 1}</h3>
                <p><strong>Aspect:</strong> ${data.aspects[index]}</p>
                <p><strong>Prompt:</strong> ${result.text}</p>
                <p class="reasoning"><strong>Reasoning:</strong> ${result.reasoning}</p>
                <div class="images">
                    ${result.images.original ? `
                        <div class="image-container">
                            <h4>Original</h4>
                            <img src="${result.images.original}" alt="Original generated image">
                        </div>
                    ` : ''}
                    ${result.images.upscaled ? `
                        <div class="image-container">
                            <h4>Upscaled</h4>
                            <img src="${result.images.upscaled}" alt="Upscaled image">
                        </div>
                    ` : ''}
                </div>
                ${result.video ? `
                    <div class="video-container">
                        <h4>Video</h4>
                        <video controls autoplay loop muted>
                            <source src="${result.video}" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                    </div>
                ` : ''}
            `;
            
            variationDiv.innerHTML = content;
            resultsContainer.appendChild(variationDiv);
        });
        
    } catch (error) {
        console.error('Error:', error);
        resultsContainer.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    } finally {
        // Re-enable submit button
        submitButton.disabled = false;
        submitButton.textContent = 'Generate';
    }
});
