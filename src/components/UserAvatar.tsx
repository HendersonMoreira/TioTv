import { useState } from 'react';

type Props = {
  name: string;
  photoURL?: string | null;
};

export function UserAvatar({ name, photoURL }: Props) {
  const [failedURL, setFailedURL] = useState<string | null>(null);
  return (
    <span className="user-avatar" role="img" aria-label={`Foto de perfil de ${name}`}>
      {photoURL && failedURL !== photoURL
        ? <img src={photoURL} alt="" referrerPolicy="no-referrer" onError={() => setFailedURL(photoURL)} />
        : (name.trim()[0] || 'U').toUpperCase()}
    </span>
  );
}
