document.getElementById('promptForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const prompt = document.getElementById('prompt').value;
    const variatorInputs = document.querySelectorAll('.variator');
    const variators = Array.from(variatorInputs).map(input => input.value);
    
    // Hide any previous results or errors
    document.getElementById('results').classList.add('hidden');
    document.getElementById('error').classList.add('hidden');
    
    // Show loading spinner
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('generateBtn').disabled = true;
    
    try {
        const response = await fetch('/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt, variators }),
        });
        
        const data = await response.json();
        
        console.log('✅ Received response:', data);

        if (!response.ok) {
            throw new Error(data.error || 'Failed to generate variations');
        }
        
        // Display results
        const variationsContainer = document.getElementById('variations');
        variationsContainer.innerHTML = data.results
            .map((result, index) => `
                <div class="variation-item">
                    <p class="variation-text">${index + 1}. ${result.text}</p>
                    <p class="variation-reasoning">${result.reasoning}</p>
                    ${result.images ? `
                        <div class="images-container">
                            ${result.images.original ? `
                                <div class="image-box">
                                    <h4>Original</h4>
                                    <img src="${result.images.original}" alt="Original image for variation ${index + 1}" class="variation-image">
                                </div>
                            ` : ''}
                            ${result.images.upscaled ? `
                                <div class="image-box">
                                    <h4>Upscaled</h4>
                                    <img src="${result.images.upscaled}" alt="Upscaled image for variation ${index + 1}" class="variation-image">
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            `)
            .join('');
        
        document.getElementById('results').classList.remove('hidden');
    } catch (error) {
        const errorElement = document.getElementById('error');
        errorElement.querySelector('.error-message').textContent = error.message;
        errorElement.classList.remove('hidden');
    } finally {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('generateBtn').disabled = false;
    }
});
