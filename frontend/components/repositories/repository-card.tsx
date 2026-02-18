// "use client";

// import { FolderGit2 } from "lucide-react";

// interface RepositoryCardProps {
//   name: string;
//   owner: string;
//   visibility: "public" | "private";
//   description: string;
//   lastUpdated: string;
// }

// export function RepositoryCard({
//   name,
//   owner,
//   visibility,
//   description,
//   lastUpdated,
// }: RepositoryCardProps) {
//   return (
//     <div className="rounded-lg border bg-card p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer">
//       <div className="flex items-center justify-between mb-2">
//         <div className="flex items-center gap-2">
//           <FolderGit2 size={18} className="text-muted-foreground" />
//           <h2 className="font-medium">{name}</h2>
//         </div>

//         <span
//           className={`text-xs px-2 py-0.5 rounded-full ${
//             visibility === "private"
//               ? "bg-red-100 text-red-600"
//               : "bg-green-100 text-green-600"
//           }`}
//         >
//           {visibility}
//         </span>
//       </div>

//       <p className="text-sm text-muted-foreground mb-3">{owner}</p>

//       <p className="text-sm line-clamp-2 mb-4">{description}</p>

//       <div className="text-xs text-muted-foreground">
//         Updated {lastUpdated}
//       </div>
//     </div>
//   );
// }

"use client";

import Link from "next/link";
import { FolderGit2 } from "lucide-react";

interface Owner {
  login: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  html_url?: string;
}

interface RepositoryCardProps {
  id: number;
  name: string;
  owner: Owner;
  visibility: "public" | "private";
  description: string;
  lastUpdated: string;
}

export function RepositoryCard({
  id,
  name,
  owner,
  visibility,
  description,
  lastUpdated,
}: RepositoryCardProps) {
  return (
    <Link href={`/repositories/${id}`}>
      <div className="rounded-lg border bg-card p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FolderGit2 size={18} className="text-muted-foreground" />
            <h2 className="font-medium">{name}</h2>
          </div>

          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              visibility === "private"
                ? "bg-red-100 text-red-600"
                : "bg-green-100 text-green-600"
            }`}
          >
            {visibility}
          </span>
        </div>

        <div className="flex items-center gap-2 mb-3">
          {owner.avatar_url && (
            <img
              src={owner.avatar_url}
              alt={owner.login}
              className="w-6 h-6 rounded-full"
            />
          )}
          <span className="text-sm text-muted-foreground">
            {owner.login}
            {owner.name ? ` (${owner.name})` : ""}
          </span>
        </div>

        <p className="text-sm line-clamp-2 mb-4">{description}</p>

        <div className="text-xs text-muted-foreground">
          Updated {lastUpdated}
        </div>
      </div>
    </Link>
  );
}
export default RepositoryCard;