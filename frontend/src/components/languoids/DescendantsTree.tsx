import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Chip, 
  IconButton,
  CircularProgress,
  Alert
} from '@mui/material';
import { 
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon 
} from '@mui/icons-material';
import { LanguoidTreeNode } from '../../services/api';

interface DescendantsTreeProps {
  nodes: LanguoidTreeNode[];
  loading?: boolean;
  error?: string | null;
}

interface TreeNodeProps {
  node: LanguoidTreeNode;
  depth: number;
  isLast: boolean;
  ancestorLines: boolean[]; // Array indicating which ancestor levels need vertical lines
}

// Determine chip color based on level
const getChipColor = (level: string): "primary" | "success" | "warning" | "default" => {
  if (level === 'family' || level === 'subfamily' || level === 'subsubfamily') return 'primary';
  if (level === 'language') return 'success';
  if (level === 'dialect') return 'warning';
  return 'default';
};

const TreeNode: React.FC<TreeNodeProps> = ({ node, depth, isLast, ancestorLines }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  
  // Build the tree prefix string using fixed-width characters
  let treePrefix = '';
  for (let i = 0; i < ancestorLines.length - 1; i++) {
    // Earlier levels: show vertical line or spaces (5 chars per level)
    treePrefix += ancestorLines[i] ? ' │   ' : '     ';
  }
  // Last level: show branch character
  if (ancestorLines.length > 0) {
    treePrefix += isLast ? ' └── ' : ' ├── ';
  }
  
  return (
    <Box>
      {/* Current node row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          py: 0.25,
          minHeight: '28px',
        }}
      >
        {/* Tree structure using monospace string */}
        {treePrefix && (
          <Typography
            component="span"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              color: 'text.secondary',
              whiteSpace: 'pre',
              userSelect: 'none',
            }}
          >
            {treePrefix}
          </Typography>
        )}

        {/* Expand/collapse caret or spacer */}
        <Box
          sx={{
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {hasChildren ? (
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{ 
                p: 0,
                width: '20px',
                height: '20px',
              }}
            >
              {expanded ? (
                <ExpandMoreIcon sx={{ fontSize: '18px' }} />
              ) : (
                <ChevronRightIcon sx={{ fontSize: '18px' }} />
              )}
            </IconButton>
          ) : null}
        </Box>

        {/* Node name and info */}
        <Typography
          variant="body2"
          sx={{ 
            flex: 1,
            ml: 0.5,
          }}
        >
          {node.name}
          {node.glottocode && (
            <Typography
              component="span"
              sx={{ color: 'text.secondary', ml: 1, fontSize: '0.8rem' }}
            >
              ({node.glottocode})
            </Typography>
          )}
        </Typography>

        {/* Level chip */}
        <Chip
          label={node.level_display}
          color={getChipColor(node.level_nal)}
          size="small"
          sx={{ ml: 2, height: '20px', fontSize: '0.7rem' }}
        />
      </Box>

      {/* Render children */}
      {hasChildren && expanded && (
        <Box>
          {node.children.map((child, index) => {
            const isLastChild = index === node.children.length - 1;
            // Build ancestor lines for children
            const childAncestorLines = [...ancestorLines, !isLastChild];
            
            return (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                isLast={isLastChild}
                ancestorLines={childAncestorLines}
              />
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export const DescendantsTree: React.FC<DescendantsTreeProps> = ({ nodes, loading, error }) => {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
          Loading descendants tree...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!nodes || nodes.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 1 }}>
        No descendants found.
      </Typography>
    );
  }

  return (
    <Box sx={{ mb: 2 }}>
      {nodes.map((node, index) => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          isLast={index === nodes.length - 1}
          ancestorLines={[]} // Root nodes have no tree prefix
        />
      ))}
    </Box>
  );
};

export default DescendantsTree;
