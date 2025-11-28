import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

interface Option {
    value: string;
    label: string;
}

interface ComboboxProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export const Combobox: React.FC<ComboboxProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Select...',
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus input when opening
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Filter options
    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        const lowerTerm = searchTerm.toLowerCase();
        return options.filter(option =>
            option.label.toLowerCase().includes(lowerTerm)
        );
    }, [options, searchTerm]);

    const selectedOption = options.find(opt => opt.value === value);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm('');
    };

    const clearSelection = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('all'); // Assuming 'all' is the "empty" value, or we could make it optional
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {/* Trigger Button */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full flex items-center justify-between p-2.5 
                    bg-slate-50 border border-slate-200 rounded-lg 
                    cursor-pointer hover:bg-slate-100 transition-colors
                    ${isOpen ? 'ring-2 ring-blue-500 border-transparent' : ''}
                `}
            >
                <span className={`block truncate ${!selectedOption ? 'text-slate-400' : 'text-slate-700'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
                    {/* Search Input */}
                    <div className="p-2 border-b border-slate-100 bg-slate-50">
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                            <input
                                ref={inputRef}
                                type="text"
                                className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="overflow-y-auto flex-1">
                        {filteredOptions.length === 0 ? (
                            <div className="p-3 text-sm text-slate-400 text-center">
                                No results found
                            </div>
                        ) : (
                            filteredOptions.map((option) => (
                                <div
                                    key={option.value}
                                    onClick={() => handleSelect(option.value)}
                                    className={`
                                        flex items-center justify-between px-3 py-2 text-sm cursor-pointer
                                        ${option.value === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}
                                    `}
                                >
                                    <span>{option.label}</span>
                                    {option.value === value && <Check size={14} />}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
