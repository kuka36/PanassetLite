import React, { useState, useEffect } from 'react';
import { Search, Tag as TagIcon, Plus, X, Clock, Bookmark } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { StorageService } from '../services/StorageService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    selectedTags: string[];
    onToggleTag: (tag: string) => void;
}

export const TagManagementModal: React.FC<Props> = ({ isOpen, onClose, selectedTags, onToggleTag }) => {
    const { t } = usePortfolio();
    const [searchQuery, setSearchQuery] = useState('');
    const [myTags, setMyTags] = useState<string[]>([]);
    const [recentTags, setRecentTags] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen) {
            setMyTags(StorageService.getMyTags());
            setRecentTags(StorageService.getRecentTags());
        }
    }, [isOpen]);

    const saveMyTags = (tags: string[]) => {
        setMyTags(tags);
        StorageService.saveMyTags(tags);
    };

    const addToRecent = (tag: string) => {
        const newRecent = [tag, ...recentTags.filter(t => t !== tag)].slice(0, 10);
        setRecentTags(newRecent);
        StorageService.saveRecentTags(newRecent);
    }

    const handleCreateTag = () => {
        const newTag = searchQuery.trim();
        if (newTag && !myTags.includes(newTag)) {
            const newTags = [...myTags, newTag];
            saveMyTags(newTags);
            onToggleTag(newTag); // Auto select
            addToRecent(newTag);
            setSearchQuery('');
        }
    };

    const handleTagClick = (tag: string) => {
        onToggleTag(tag);
        // If selecting (not deselecting), add to recent
        if (!selectedTags.includes(tag)) {
            addToRecent(tag);
        }
    };

    const filteredMyTags = myTags.filter(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    // Filter out tags that are already in "My Tags" directly to avoid duplicates in display if we wanted, 
    // but requirements say "Recent" and "My Tags". Usually Recent is a subset.
    // We will show both sections.

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <TagIcon size={18} className="text-blue-600" />
                        {t('manageTags') || 'Manage Tags'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-slate-50">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search or create tags..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-4 space-y-6">

                    {/* Create New Tag Action (if searching) */}
                    {searchQuery && !myTags.includes(searchQuery.trim()) && (
                        <div
                            onClick={handleCreateTag}
                            className="flex items-center gap-3 p-3 bg-blue-50 text-blue-700 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors"
                        >
                            <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center">
                                <Plus size={16} />
                            </div>
                            <span className="font-medium">Create tag "{searchQuery}"</span>
                        </div>
                    )}

                    {/* Recent Tags */}
                    {recentTags.length > 0 && !searchQuery && (
                        <div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                                <Clock size={12} /> {t('recentTags') || 'Recent'}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {recentTags.map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => handleTagClick(tag)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedTags.includes(tag)
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* My Tags */}
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                            <Bookmark size={12} /> {t('myTags') || 'My Tags'}
                        </div>
                        {filteredMyTags.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 text-sm">
                                {searchQuery ? 'No tags found.' : 'No tags yet. Create one above!'}
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {filteredMyTags.map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => handleTagClick(tag)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedTags.includes(tag)
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};
