import { writable } from 'svelte/store';

interface AIState {
  isGenerating: boolean;
  lastError: string | null;
  aiDialogOpen: boolean;
}

// Create the initial state
const initialState: AIState = {
  isGenerating: false,
  lastError: null,
  aiDialogOpen: false
};

// Create the store
export const aiState = writable<AIState>(initialState);

// Function to generate text using the API
export async function generateText(prompt: string): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    console.log('Generating text with prompt:', prompt);
    aiState.update(state => ({ ...state, isGenerating: true, lastError: null }));
    
    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt })
    });
    
    console.log('Response status:', response.status);
    
    // If response is not ok, try to get error message as text
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      
      const errorMessage = `Server error: ${response.status}`;
      aiState.update(state => ({ 
        ...state, 
        isGenerating: false, 
        lastError: errorMessage
      }));
      return { success: false, error: errorMessage };
    }
    
    // For debugging, get response as text first
    const responseText = await response.text();
    console.log('Raw response text:', responseText);
    
    // Parse the response text
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      const errorMessage = 'Invalid response format from server';
      aiState.update(state => ({ 
        ...state, 
        isGenerating: false, 
        lastError: errorMessage
      }));
      return { success: false, error: errorMessage };
    }
    
    if (!data.success) {
      aiState.update(state => ({ 
        ...state, 
        isGenerating: false, 
        lastError: data.error || 'An unknown error occurred' 
      }));
      return { success: false, error: data.error };
    }
    
    aiState.update(state => ({ ...state, isGenerating: false }));
    return { success: true, text: data.text };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to connect to AI service';
    console.error('Generate text error:', error);
    aiState.update(state => ({ 
      ...state, 
      isGenerating: false, 
      lastError: errorMessage
    }));
    return { success: false, error: errorMessage };
  }
}

// Toggle the AI dialog
export function toggleAIDialog(open?: boolean): void {
  aiState.update(state => ({ 
    ...state, 
    aiDialogOpen: open !== undefined ? open : !state.aiDialogOpen
  }));
} 