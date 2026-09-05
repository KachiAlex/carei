import { useState, useRef, useEffect } from 'react'
import { X, Plus } from 'lucide-react'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  suggestions?: string[]
  maxTags?: number
  disabled?: boolean
  className?: string
}

export default function TagInput({ 
  tags, 
  onChange, 
  placeholder = "Add item...", 
  suggestions = [],
  maxTags = 20,
  disabled = false,
  className = ""
}: TagInputProps) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (input.trim()) {
      const filtered = suggestions.filter(
        suggestion => 
          suggestion.toLowerCase().includes(input.toLowerCase()) &&
          !tags.includes(suggestion)
      )
      setFilteredSuggestions(filtered.slice(0, 5))
      setShowSuggestions(filtered.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }, [input, suggestions, tags])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (trimmed && !tags.includes(trimmed) && tags.length < maxTags) {
      onChange([...tags, trimmed])
      setInput('')
      setShowSuggestions(false)
    }
  }

  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, index) => index !== indexToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (input.trim()) {
        addTag(input)
      }
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags.length - 1)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    addTag(suggestion)
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Tags */}
      <div className="flex flex-wrap gap-2 p-3 bg-white border border-slate-200 rounded-xl min-h-[48px] focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-100 transition-all">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-3 py-1 bg-teal-50 text-teal-700 rounded-lg text-sm font-medium"
          >
            {tag}
            <button
              onClick={() => removeTag(index)}
              disabled={disabled}
              className="text-teal-500 hover:text-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <X size={14} />
            </button>
          </span>
        ))}
        
        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={tags.length === 0 ? placeholder : ''}
          disabled={disabled || tags.length >= maxTags}
          className="flex-1 min-w-[120px] outline-none text-slate-700 placeholder-slate-400 disabled:opacity-50"
        />
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && !disabled && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-teal-50 focus:bg-teal-50 focus:outline-none transition-colors"
            >
              <div className="flex items-center gap-2">
                <Plus size={14} className="text-teal-500" />
                {suggestion}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Character count and limits */}
      <div className="flex justify-between items-center mt-1 text-xs text-slate-500">
        <span>Press Enter or comma to add</span>
        {maxTags && (
          <span>{tags.length}/{maxTags} items</span>
        )}
      </div>
    </div>
  )
}
