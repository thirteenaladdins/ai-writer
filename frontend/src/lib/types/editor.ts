export type BlockType = 'paragraph' | 'heading' | 'list_item' | 'code' | 'quote';

export interface Block {
    id: string;
    type: BlockType;
    content: string;
    position: number;
    metadata: Record<string, any>;
}

export interface Document {
    id: string;
    title: string;
    blocks: Block[];
    created_at: string;
    updated_at: string;
} 