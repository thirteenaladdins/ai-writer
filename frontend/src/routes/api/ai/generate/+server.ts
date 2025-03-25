import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import http from 'http';

const BACKEND_URL = 'http://localhost:8000'; // Direct backend URL

export const POST: RequestHandler = async ({ request }) => {
    try {
        console.log('Starting AI generation request...');
        const body = await request.json();
        console.log('Request body:', body);
        
        // Return a Promise that resolves with the backend response
        const responseData = await new Promise((resolve, reject) => {
            console.log('Preparing connection to backend...');
            // Prepare the request options
            const options = {
                hostname: '127.0.0.1', // Explicitly use IPv4
                port: 8000,
                path: '/api/ai/generate',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            console.log('Connection options:', options);
            
            // Create the request
            console.log('Creating HTTP request...');
            const req = http.request(options, (res) => {
                console.log('Received response from backend');
                let data = '';
                
                // Collect response data
                res.on('data', (chunk) => {
                    console.log('Received data chunk:', chunk.toString());
                    data += chunk;
                });
                
                // Process response when completed
                res.on('end', () => {
                    const statusCode = res.statusCode || 500;
                    console.log('Backend response status:', statusCode);
                    console.log('Raw backend response:', data);
                    
                    if (statusCode >= 400) {
                        console.error('Backend returned error status:', statusCode);
                        reject(new Error(`Backend error: ${statusCode} ${data}`));
                        return;
                    }
                    
                    try {
                        // Try to parse the response as JSON
                        console.log('Attempting to parse JSON response...');
                        const parsedData = JSON.parse(data);
                        console.log('Successfully parsed JSON response');
                        resolve(parsedData);
                    } catch (error) {
                        console.error('JSON parse error:', error, 'Raw response:', data);
                        reject(new Error('Invalid JSON response from backend'));
                    }
                });
            });
            
            // Handle request errors
            req.on('error', (error: NodeJS.ErrnoException) => {
                console.error('Request error details:', {
                    message: error.message,
                    code: error.code,
                    stack: error.stack
                });
                reject(new Error(`Failed to connect to backend: ${error.message}`));
            });
            
            // Log before sending request
            console.log('Sending request to backend...');
            // Send the request body
            req.write(JSON.stringify(body));
            req.end();
            console.log('Request sent to backend');
        });
        
        console.log('Successfully received response from backend');
        return json(responseData);
    } catch (error) {
        console.error('Error in AI generation endpoint:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });
        return json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate text'
        }, { status: 500 });
    }
} 