import React from 'react';

interface BlockyAvatarProps {
  config: string | null | undefined;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'responsive';
}

export const SKIN_COLORS = {
  '1': '#ffdbac',
  '2': '#f1c27d',
  '3': '#e0ac69',
  '4': '#c68642',
  '5': '#8d5524',
};

export const HAIR_COLORS = {
  '1': '#573d26',
  '2': '#e29c3f',
  '3': '#d946ef',
  '4': '#18181b',
  '5': '#ef4444',
};

export const BEARD_COLORS = {
  '1': 'transparent',
  '2': '#3f3f46',
  '3': '#3f3f46',
  '4': '#3f3f46',
  '5': 'rgba(0, 0, 0, 0.25)',
};

export function getAvatarMatrix(gender: string, skin: string, hair: string, beard: string) {
  const matrix = Array(8).fill(null).map(() => Array(8).fill('#000000'));
  
  const skinColor = SKIN_COLORS[skin as keyof typeof SKIN_COLORS] || SKIN_COLORS['1'];
  const hairColor = HAIR_COLORS[hair as keyof typeof HAIR_COLORS] || HAIR_COLORS['1'];
  const beardColor = BEARD_COLORS[beard as keyof typeof BEARD_COLORS] || BEARD_COLORS['1'];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      matrix[r][c] = skinColor;
    }
  }

  if (hair === '1') {
    for (let c = 0; c < 8; c++) {
      matrix[0][c] = hairColor;
      matrix[1][c] = hairColor;
    }
    matrix[2][0] = hairColor;
    matrix[2][1] = hairColor;
    matrix[2][2] = hairColor;
    matrix[2][5] = hairColor;
    matrix[2][6] = hairColor;
    matrix[2][7] = hairColor;
  } else if (hair === '2') {
    for (let c = 0; c < 8; c++) {
      matrix[0][c] = hairColor;
      matrix[1][c] = hairColor;
    }
    matrix[2][0] = hairColor;
    matrix[2][1] = hairColor;
    matrix[2][2] = hairColor;
    matrix[2][5] = hairColor;
    matrix[2][6] = hairColor;
    matrix[2][7] = hairColor;
    matrix[3][0] = hairColor;
    matrix[3][7] = hairColor;
    matrix[4][0] = hairColor;
    matrix[4][7] = hairColor;
    matrix[5][0] = hairColor;
    matrix[5][7] = hairColor;
  } else if (hair === '3') {
    for (let r = 0; r < 3; r++) {
      matrix[r][3] = hairColor;
      matrix[r][4] = hairColor;
    }
  } else if (hair === '4') {
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 8; c++) {
        matrix[r][c] = hairColor;
      }
    }
    matrix[2][0] = hairColor;
    matrix[2][7] = hairColor;
    matrix[3][0] = hairColor;
    matrix[3][7] = hairColor;
  } else if (hair === '5') {
    for (let c = 0; c < 8; c++) {
      matrix[0][c] = hairColor;
      matrix[1][c] = hairColor;
    }
  }

  if (gender === 'male') {
    if (beard === '2') {
      matrix[5][2] = beardColor;
      matrix[5][3] = beardColor;
      matrix[5][4] = beardColor;
      matrix[5][5] = beardColor;
    } else if (beard === '3') {
      matrix[5][3] = beardColor;
      matrix[5][4] = beardColor;
      matrix[6][3] = beardColor;
      matrix[6][4] = beardColor;
      matrix[7][3] = beardColor;
      matrix[7][4] = beardColor;
    } else if (beard === '4') {
      matrix[4][0] = beardColor;
      matrix[4][7] = beardColor;
      matrix[5][0] = beardColor;
      matrix[5][7] = beardColor;
      matrix[5][2] = beardColor;
      matrix[5][3] = beardColor;
      matrix[5][4] = beardColor;
      matrix[5][5] = beardColor;
      for (let c = 0; c < 8; c++) {
        matrix[6][c] = beardColor;
        matrix[7][c] = beardColor;
      }
    } else if (beard === '5') {
      matrix[4][0] = beardColor;
      matrix[4][7] = beardColor;
      matrix[5][0] = beardColor;
      matrix[5][1] = beardColor;
      matrix[5][6] = beardColor;
      matrix[5][7] = beardColor;
      for (let c = 1; c < 7; c++) {
        matrix[6][c] = beardColor;
        matrix[7][c] = beardColor;
      }
    }
  }

  matrix[4][1] = '#ffffff';
  matrix[4][2] = '#3b82f6';
  matrix[4][5] = '#3b82f6';
  matrix[4][6] = '#ffffff';

  matrix[6][3] = '#e11d48';
  matrix[6][4] = '#e11d48';

  return matrix;
}

export function BlockyAvatar({ config, size = 'sm' }: BlockyAvatarProps) {
  const safeConfig = config || 'male-1-1-1';
  const [gender, skin, hair, beard] = safeConfig.split('-');

  const matrix = getAvatarMatrix(gender || 'male', skin || '1', hair || '1', beard || '1');

  const sizeClasses = {
    xs: 'w-5 h-5',
    sm: 'w-8 h-8',
    md: 'w-16 h-16',
    lg: 'w-32 h-32',
    responsive: 'w-full h-full',
  };

  const dimensions = sizeClasses[size as keyof typeof sizeClasses] || sizeClasses.sm;

  return (
    <div 
      className={`shrink-0 select-none ${dimensions}`}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        gridTemplateRows: 'repeat(8, 1fr)'
      }}
    >
      {matrix.flatMap((row, rIdx) =>
        row.map((color, cIdx) => (
          <div
            key={`${rIdx}-${cIdx}`}
            className="w-full h-full"
            style={{ backgroundColor: color }}
          />
        ))
      )}
    </div>
  );
}
