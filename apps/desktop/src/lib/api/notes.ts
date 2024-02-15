import { writeTextFile, readDir, readTextFile, renameFile } from '@tauri-apps/api/fs';
import { activeFile, editor, noteHistory } from '@/store';
import { resetEditorContent } from '@/utils';
import { homeDir } from '@tauri-apps/api/path';
import { get } from 'svelte/store';

// Create a new note
export const createNote = async (dirPath: string) => {
	// Read the directory
	const files = await readDir(dirPath);

	// Generate a new name (Untitled.md, if there are any exiting Untitled notes, increment the number by 1)
	const untitledNotes = files.filter(
		(file) => file.name?.toLowerCase().startsWith('untitled') && file.children === undefined
	);
	const name = `Untitled${untitledNotes.length ? ` ${untitledNotes.length}` : ''}.md`;

	// Save the new note
	await writeTextFile(`${dirPath}/${name}`, '');

	// Open the note
	openNote(`${dirPath}/${name}`);
};

// Open a note
export async function openNote(path: string, skipHistory = false) {
	const fileContent = await readTextFile(path);
	resetEditorContent(fileContent, path.split('/').pop()!.split('.').shift()!);
	activeFile.set(path);
	if (!skipHistory) {
		noteHistory.update((history) => {
			if (history[history.length - 1] !== path) {
				return [...history, path];
			}
			return history;
		});
	}
}

// Delete a note
export const deleteNote = async (path: string) => {
	// TODO: Wont work on Windows
	await renameFile(path, `${await homeDir()}.trash/${path.split('/').pop()!}`);
	activeFile.set('');
};

// Rename a note
export const renameNote = async (path: string, name: string) => {
	await renameFile(path, `${path.split('/').slice(0, -1).join('/')}/${name}`);
	activeFile.set(`${path.split('/').slice(0, -1).join('/')}/${name}`);
};

// Save active note
export const saveNote = async (path: string) => {
	// Get note content
	let content = get(editor).storage.markdown.getMarkdown();

	// Remove the first heading title
	content = content.replace(/^# .*\n/, '');

	await writeTextFile(path, content);
};

export const moveNote = async (source: string, target: string) => {
	// Get target directory
	const files = await readDir(target);

	// Make sure there are no name conflicts
	const noteName = source.split('/').pop()!;

	if (files.some((file) => file.name === noteName && file.children === undefined)) {
		throw new Error('Name conflict');
	}

	await renameFile(source, target + '/' + noteName);
	openNote(target + '/' + noteName);
};

// Duplicate a note (format: "<name> (<number>).<ext>") - <number> is incremented if there are any existing notes with the same name
export const duplicateNote = async (path: string) => {
	// Fetch the content of the note
	const content = await readTextFile(path);

	// Extract the name and extension of the note
	const name = path
		.split('/')
		.pop()!
		.split('.')
		.shift()!
		.replace(/\s\(\d+\)$/, '');
	const ext = path.split('.').pop()!;

	// Get current index of the note
	const files = await readDir(path.split('/').slice(0, -1).join('/'));
	const notes = files.filter((file) => file.name?.startsWith(name) && file.children === undefined);

	// Write the new note
	const newName = `${name} (${notes.length}).${ext}`;
	await writeTextFile(`${path.split('/').slice(0, -1).join('/')}/${newName}`, content);

	// Open the new note
	openNote(`${path.split('/').slice(0, -1).join('/')}/${newName}`);
};
