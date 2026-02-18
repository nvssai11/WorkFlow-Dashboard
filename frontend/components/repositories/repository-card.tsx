"use client";

import Link from "next/link";
import { FolderGit2 } from "lucide-react";
import { Owner } from "@/types/repository";

interface Props {
  id: number;
  name: string;
  owner: Owner;
  visibility: "public" | "private";
  description: string;
}

export default function RepositoryCard({
  id,
  name,
  owner,
  visibility,
  description,
}: Props) {
  return (
    <div
      className="group bg-white dark:bg-zinc-900 
                 border border-primary/40 
                 rounded-2xl shadow-sm hover:shadow-2xl 
                 transition-all duration-300 
                 hover:-translate-y-1 
                 hover:border-primary
                 flex flex-col overflow-hidden"
    >

      {/* Content */}
      <Link href={`/repositories/${id}`} className="flex-1 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <FolderGit2 size={18} className="text-zinc-600 dark:text-zinc-300" />
            </div>
            <h2 className="font-semibold text-lg text-zinc-900 dark:text-white">
              {name}
            </h2>
          </div>

          <span
            className={`text-xs font-medium px-3 py-1 rounded-full ${
              visibility === "private"
                ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
            }`}
          >
            {visibility}
          </span>
        </div>

        <div className="flex items-center gap-3 mb-4">
          {owner.avatar_url ? (
            <img
              src={owner.avatar_url}
              alt={owner.login}
              className="w-8 h-8 rounded-full ring-2 ring-zinc-200 dark:ring-zinc-700"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700" />
          )}

          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {owner.login}
          </span>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
          {description}
        </p>
      </Link>

      {/* Footer Button */}
      <Link href={`/repositories/${id}`}>
        <div className="flex items-center justify-center gap-2 
                        bg-primary text-primary-foreground 
                        px-4 py-4 
                        text-sm font-medium 
                        hover:bg-primary/90 
                        transition-colors">
          Select Repository
        </div>
      </Link>
    </div>
  );
}
