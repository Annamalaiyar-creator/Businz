import React, { useState } from 'react';

// Inline Click-to-Edit & Quick-Remove Helper Component
export const EditableText = ({
  value,
  fallback = '',
  onSave,
  onRemove,
  removeLabel,
  style = {},
  tag = 'span',
  className = '',
  multiline = false,
  placeholder = 'Click to edit...',
  isEditable = false
}) => {
  const [isHovered, setIsHovered] = useState(false);

  if (!isEditable || !onSave) {
    const Tag = tag;
    return <Tag style={style} className={className}>{value || fallback}</Tag>;
  }

  return (
    <span
      style={{
        position: 'relative',
        display: style.display || (multiline ? 'block' : 'inline-block'),
        verticalAlign: 'middle',
        maxWidth: '100%'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => {
          const text = e.currentTarget.innerText.trim();
          if (text !== value) {
            onSave(text);
          }
        }}
        onKeyDown={(e) => {
          if (!multiline && e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        style={{
          ...style,
          outline: 'none',
          cursor: 'text',
          borderBottom: isHovered ? '1px dashed #0E7490' : '1px dashed transparent',
          backgroundColor: isHovered ? 'rgba(14, 116, 144, 0.05)' : 'transparent',
          borderRadius: '2px',
          padding: '0 2px',
          transition: 'border-color 0.15s ease, background-color 0.15s ease',
          minWidth: '20px'
        }}
        className={`interactive-editable-field ${className}`}
        title="Click to edit text directly"
      >
        {value || fallback || placeholder}
      </span>
      {onRemove && (
        <button
          type="button"
          className="no-print"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onRemove();
          }}
          title={removeLabel ? `Remove ${removeLabel}` : 'Remove from print/PDF'}
          style={{
            position: 'absolute',
            top: '-6px',
            right: '-16px',
            opacity: isHovered ? 1 : 0.65,
            visibility: 'visible',
            transition: 'opacity 0.15s ease',
            backgroundColor: '#EF4444',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '50%',
            width: '15px',
            height: '15px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9px',
            fontWeight: '900',
            cursor: 'pointer',
            padding: 0,
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            zIndex: 10
          }}
        >
          ✕
        </button>
      )}
    </span>
  );
};

// Removable Section / Card Wrapper
export const RemovableBlock = ({
  visible = true,
  settingKey,
  label,
  children,
  onUpdateSetting,
  onElementRemoved,
  isEditable = false,
  style = {},
  className = '',
  buttonPosition = 'top-right'
}) => {
  const [hovered, setHovered] = useState(false);

  if (!visible) return null;

  const handleRemove = () => {
    onUpdateSetting?.({ [settingKey]: false });
    onElementRemoved?.(settingKey, label);
  };

  const btnPosStyle =
    buttonPosition === 'top-left'
      ? { top: '2px', left: '2px' }
      : buttonPosition === 'inline-right'
      ? { position: 'static', marginLeft: '6px' }
      : { top: '2px', right: '2px' };

  return (
    <div
      style={{ position: 'relative', ...style }}
      className={`removable-print-block ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
      {isEditable && (
        <button
          type="button"
          className="no-print quick-remove-btn"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleRemove();
          }}
          title={`Remove ${label} from print/PDF (Restore anytime via Customize Template)`}
          style={{
            position: buttonPosition === 'inline-right' ? 'static' : 'absolute',
            ...btnPosStyle,
            opacity: hovered ? 1 : 0.65,
            visibility: 'visible',
            transition: 'opacity 0.15s ease',
            backgroundColor: '#EF4444',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9px',
            fontWeight: '900',
            cursor: 'pointer',
            padding: 0,
            boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
            zIndex: 20
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
};

// Removable Key-Value Row in Details Cards
export const RemovableMetaRow = ({
  visible = true,
  settingKey,
  label,
  onUpdateSetting,
  onElementRemoved,
  isEditable = false,
  children,
  style = {}
}) => {
  const [hovered, setHovered] = useState(false);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '4px',
        ...style
      }}
      className="removable-meta-row"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {children}
      </div>
      {isEditable && (
        <button
          type="button"
          className="no-print"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onUpdateSetting?.({ [settingKey]: false });
            onElementRemoved?.(settingKey, label);
          }}
          title={`Remove ${label} from print/PDF`}
          style={{
            opacity: hovered ? 1 : 0.65,
            visibility: 'visible',
            transition: 'opacity 0.15s ease',
            backgroundColor: '#EF4444',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '50%',
            width: '14px',
            height: '14px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '8.5px',
            fontWeight: '900',
            cursor: 'pointer',
            padding: 0,
            boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
            flexShrink: 0,
            marginTop: '2px'
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
};

// Removable Table Header Column Cell
export const RemovableTableHeaderCell = ({
  visible = true,
  settingKey,
  label,
  title,
  onSaveTitle,
  canRemove = true,
  align = 'left',
  width,
  onUpdateSetting,
  onElementRemoved,
  isEditable = false
}) => {
  const [hovered, setHovered] = useState(false);

  if (!visible) return null;

  return (
    <th
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        padding: align === 'left' ? '8px 10px' : (align === 'right' ? '8px 8px' : '8px 6px'),
        borderRight: '1px solid rgba(255,255,255,0.2)',
        width: width,
        textAlign: align,
        color: '#FFFFFF',
        fontWeight: '700'
      }}
    >
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: align === 'right' ? 'flex-end' : (align === 'left' ? 'flex-start' : 'center'),
        gap: '4px',
        width: align === 'right' ? '100%' : 'auto'
      }}>
        <EditableText
          value={title}
          fallback={label}
          onSave={onSaveTitle}
          isEditable={isEditable}
          style={{ color: '#FFFFFF', fontWeight: '700' }}
        />
        {isEditable && canRemove && (
          <button
            type="button"
            className="no-print"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onUpdateSetting?.({ [settingKey]: false });
              onElementRemoved?.(settingKey, label);
            }}
            title={`Remove ${label} from print/PDF`}
            style={{
              opacity: hovered ? 1 : 0.65,
              visibility: 'visible',
              transition: 'opacity 0.15s ease',
              backgroundColor: '#EF4444',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '50%',
              width: '15px',
              height: '15px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '9px',
              fontWeight: '900',
              cursor: 'pointer',
              padding: 0,
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              flexShrink: 0
            }}
          >
            ✕
          </button>
        )}
      </div>
    </th>
  );
};
