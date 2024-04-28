import type * as CONST from '../constants.d.ts';
import type { DataField, DataSchema } from '../data/fields.d.ts';
import type * as documents from '../documents/module.d.ts';
import type BaseUser from '../documents/user.d.ts';
import type DataModel from './data.d.ts';
import type { DataModelValidationOptions } from './data.d.ts';
import type EmbeddedCollection from './embedded-collection.d.ts';
import type * as abstract from './module.d.ts';

/** The abstract base interface for all Document types. */
export default abstract class Document<
	TParent extends Document | null = _Document | null,
	TSchema extends DataSchema = DataSchema
> extends DataModel<TParent, TSchema> {
	protected override _configure(options?: { pack?: string | null; parentCollection?: string | null }): void;

	/**
	 * An immutable reverse-reference to the name of the collection that this Document exists in on its parent, if any.
	 */
	readonly parentCollection: string | null;

	/** An immutable reference to a containing Compendium collection to which this Document belongs. */
	readonly pack: string | null;

	protected override _initialize(options?: Record<string, unknown>): void;

	/* -------------------------------------------- */
	/*  Model Configuration                         */
	/* -------------------------------------------- */

	/** Default metadata which applies to each instance of this Document type. */
	static get metadata(): DocumentMetadata;

	/**
	 * The database backend used to execute operations and handle results.
	 * @type {abstract.DatabaseBackend}
	 */
	static get database(): abstract.DatabaseBackend;

	/** Return a reference to the implemented subclass of this base document type. */
	static get implementation(): typeof Document;

	/** The named collection to which this Document belongs. */
	static get collectionName(): string;
	/** The named collection to which this Document belongs. */
	get collectionName(): string;

	/** The canonical name of this Document type, for example "Actor". */
	static get documentName(): string;
	/** The canonical name of this Document type, for example "Actor". */
	get documentName(): string;

	/** Does this Document support additional sub-types? */
	static get hasTypeData(): boolean;

	/* -------------------------------------------- */
	/*  Model Properties                            */
	/* -------------------------------------------- */

	/** The Embedded Document hierarchy for this Document. */
	static get hierarchy(): Record<string, DataField>;

	/**
	 * Determine the collection this Document exists in on its parent, if any.
	 * @param [parentCollection]  An explicitly provided parent collection name.
	 */
	protected _getParentCollection(parentCollection: string): string | null;

	/** The canonical identifier for this Document. */
	get id(): string;

	/** Test whether this Document is embedded within a parent Document */
	get isEmbedded(): boolean;

	/* ---------------------------------------- */
	/*  Model Permissions                       */
	/* ---------------------------------------- */

	/**
	 * Test whether a given User has a sufficient role in order to create Documents of this type in general.
	 * @param user The User being tested
	 * @return Does the User have a sufficient role to create?
	 */
	static canUserCreate(user: documents.BaseUser): boolean;

	/**
	 * Get the explicit permission level that a User has over this Document, a value in CONST.DOCUMENT_OWNERSHIP_LEVELS.
	 * This method returns the value recorded in Document ownership, regardless of the User's role.
	 * To test whether a user has a certain capability over the document, testUserPermission should be used.
	 * @param {documents.BaseUser} user     The User being tested
	 * @returns {number|null}               A numeric permission level from CONST.DOCUMENT_OWNERSHIP_LEVELS or null
	 */
	getUserLevel(user: documents.BaseUser): DocumentOwnershipLevel | null;

	/**
	 * Test whether a certain User has a requested permission level (or greater) over the Document
	 * @param user       The User being tested
	 * @param permission The permission level from DOCUMENT_PERMISSION_LEVELS to test
	 * @param options    Additional options involved in the permission test
	 * @param [options.exact=false] Require the exact permission level requested?
	 * @return Does the user have this permission level over the Document?
	 */
	testUserPermission(
		user: BaseUser,
		permission: DocumentOwnershipString | DocumentOwnershipLevel,
		{ exact }?: { exact?: boolean }
	): boolean;

	/**
	 * Test whether a given User has permission to perform some action on this Document
	 * @param user   The User attempting modification
	 * @param action The attempted action
	 * @param [data] Data involved in the attempted action
	 * @return Does the User have permission?
	 */
	canUserModify(user: BaseUser, action: UserAction, data?: Record<string, unknown>): boolean;

	/* ---------------------------------------- */
	/*  Model Methods                           */
	/* ---------------------------------------- */

	/**
	 * Clone a document, creating a new document by combining current data with provided overrides.
	 * The cloned document is ephemeral and not yet saved to the database.
	 * @param [data={}]              Additional data which overrides current document data at the time of creation
	 * @param [context={}]           Additional options which customize the creation workflow
	 * @param [context.save=false]   Save the clone to the World database?
	 * @param [context.keepId=false] Keep the original Document ID? Otherwise the ID will become undefined
	 * @returns The cloned Document instance
	 */
	override clone(
		data: Record<string, unknown> | undefined,
		context: DocumentCloneContext & { save: true }
	): Promise<this>;
	override clone(data?: Record<string, unknown>, context?: DocumentCloneContext & { save?: false }): this;
	override clone(data?: Record<string, unknown>, context?: DocumentCloneContext): this | Promise<this>;

	/**
	 * For Documents which include game system data, migrate the system data object to conform to its latest data model.
	 * The data model is defined by the template.json specification included by the game system.
	 * @returns The migrated system data object
	 */
	migrateSystemData(): Record<string, unknown>;

	/* -------------------------------------------- */
	/*  Database Operations                         */
	/* -------------------------------------------- */

	/**
	 * Validate the data contained in the document to check for type and content
	 * This function throws an error if data within the document is not valid
	 *
	 * @param options Optional parameters which customize how validation occurs.
	 * @param [options.changes]        A specific set of proposed changes to validate, rather than the full
	 *                                 source data of the model.
	 * @param [options.clean=false]    If changes are provided, attempt to clean the changes before validating
	 *                                 them?
	 * @param [options.fallback=false] Allow replacement of invalid values with valid defaults?
	 * @param [options.strict=true]    Throw if an invalid value is encountered, otherwise log a warning?
	 * @param [options.fields=true]    Perform validation on individual fields?
	 * @param [options.joint]          Perform joint validation on the full data model?
	 *                                 Joint validation will be performed by default if no changes are passed.
	 *                                 Joint validation will be disabled by default if changes are passed.
	 *                                 Joint validation can be performed on a complete set of changes (for
	 *                                 example testing a complete data model) by explicitly passing true.
	 * @return An indicator for whether the document contains valid data
	 */
	validate(options?: DataModelValidationOptions): boolean;

	/**
	 * Get the explicit permission level that a User has over this Document, a value in CONST.DOCUMENT_OWNERSHIP_LEVELS.
	 * This method returns the value recorded in Document ownership, regardless of the User's role.
	 * To test whether a user has a certain capability over the document, testUserPermission should be used.
	 * @param user The User being tested
	 * @returns A numeric permission level from CONST.DOCUMENT_OWNERSHIP_LEVELS or null
	 */
	getUserLevel(user: BaseUser): DocumentOwnershipLevel | null;

	/**
	 * Migrate candidate source data for this DataModel which may require initial cleaning or transformations.
	 * @param source           The candidate source data from which the model will be constructed
	 * @returns                Migrated source data, if necessary
	 */
	static migrateData<TSource extends object>(source: TSource): TSource;

	/* -------------------------------------------- */
	/*  Database Operations                         */
	/* -------------------------------------------- */

	/**
	 * Create multiple Documents using provided input data.
	 * Data is provided as an array of objects where each individual object becomes one new Document.
	 *
	 * @param data An array of data objects used to create multiple documents
	 * @param [context={}] Additional context which customizes the creation workflow
	 * @return An array of created Document instances
	 *
	 * @example <caption>Create a single Document</caption>
	 * const data = [{name: "New Actor", type: "character", img: "path/to/profile.jpg"}];
	 * const created = await Actor.createDocuments(data);
	 *
	 * @example <caption>Create multiple Documents</caption>
	 * const data = [{name: "Tim", type: "npc"], [{name: "Tom", type: "npc"}];
	 * const created = await Actor.createDocuments(data);
	 *
	 * @example <caption>Create multiple embedded Documents within a parent</caption>
	 * const actor = game.actors.getName("Tim");
	 * const data = [{name: "Sword", type: "weapon"}, {name: "Breastplate", type: "equipment"}];
	 * const created = await Item.createDocuments(data, {parent: actor});
	 *
	 * @example <caption>Create a Document within a Compendium pack</caption>
	 * const data = [{name: "Compendium Actor", type: "character", img: "path/to/profile.jpg"}];
	 * const created = await Actor.createDocuments(data, {pack: "mymodule.mypack"});
	 */
	static createDocuments<TDocument extends Document>(
		this: ConstructorOf<TDocument>,
		data?: (TDocument | PreCreate<TDocument['_source']>)[],
		context?: DocumentModificationContext<TDocument['parent']>
	): Promise<TDocument[]>;

	/**
	 * Update multiple Document instances using provided differential data.
	 * Data is provided as an array of objects where each individual object updates one existing Document.
	 *
	 * @param updates An array of differential data objects, each used to update a single Document
	 * @param [context={}] Additional context which customizes the update workflow
	 * @return An array of updated Document instances
	 *
	 * @example <caption>Update a single Document</caption>
	 * const updates = [{_id: "12ekjf43kj2312ds", name: "Timothy"}];
	 * const updated = await Actor.updateDocuments(updates);
	 *
	 * @example <caption>Update multiple Documents</caption>
	 * const updates = [{_id: "12ekjf43kj2312ds", name: "Timothy"}, {_id: "kj549dk48k34jk34", name: "Thomas"}]};
	 * const updated = await Actor.updateDocuments(updates);
	 *
	 * @example <caption>Update multiple embedded Documents within a parent</caption>
	 * const actor = game.actors.getName("Timothy");
	 * const updates = [{_id: sword.id, name: "Magic Sword"}, {_id: shield.id, name: "Magic Shield"}];
	 * const updated = await Item.updateDocuments(updates, {parent: actor});
	 *
	 * @example <caption>Update Documents within a Compendium pack</caption>
	 * const actor = await pack.getDocument(documentId);
	 * const updated = await Actor.updateDocuments([{_id: actor.id, name: "New Name"}], {pack: "mymodule.mypack"});
	 */
	static updateDocuments<TDocument extends Document>(
		this: ConstructorOf<TDocument>,
		updates?: Record<string, unknown>[],
		context?: DocumentModificationContext<TDocument['parent']>
	): Promise<TDocument[]>;

	/**
	 * Delete one or multiple existing Documents using an array of provided ids.
	 * Data is provided as an array of string ids for the documents to delete.
	 *
	 * @param ids           An array of string ids for the documents to be deleted
	 * @param [context={}] Additional context which customizes the deletion workflow
	 * @return An array of deleted Document instances
	 *
	 * @example <caption>Delete a single Document</caption>
	 * const tim = game.actors.getName("Tim");
	 * const deleted = await Actor.deleteDocuments([tim.id]);
	 *
	 * @example <caption>Delete multiple Documents</caption>
	 * const tim = game.actors.getName("Tim");
	 * const tom = game.actors.getName("Tom");
	 * const deleted = await Actor.deleteDocuments([tim.id, tom.id]);
	 *
	 * @example <caption>Delete multiple embedded Documents within a parent</caption>
	 * const tim = game.actors.getName("Tim");
	 * const sword = tim.items.getName("Sword");
	 * const shield = tim.items.getName("Shield");
	 * const deleted = await Item.deleteDocuments([sword.id, shield.id], parent: actor});
	 *
	 * @example <caption>Delete Documents within a Compendium pack</caption>
	 * const actor = await pack.getDocument(documentId);
	 * const deleted = await Actor.deleteDocuments([actor.id], {pack: "mymodule.mypack"});
	 */
	static deleteDocuments<TDocument extends Document>(
		this: ConstructorOf<TDocument>,
		ids?: string[],
		context?: DocumentModificationContext<TDocument['parent']>
	): Promise<TDocument[]>;

	/**
	 * Create a new Document using provided input data, saving it to the database.
	 * @see {@link Document.createDocuments}
	 * @param [data={}]    Initial data used to create this Document
	 * @param [context={}] Additional context which customizes the creation workflow
	 * @return The created Document instance
	 *
	 * @example <caption>Create a World-level Item</caption>
	 * const data = [{name: "Special Sword", type: "weapon"}];
	 * const created = await Item.create(data);
	 *
	 * @example <caption>Create an Actor-owned Item</caption>
	 * const data = [{name: "Special Sword", type: "weapon"}];
	 * const actor = game.actors.getName("My Hero");
	 * const created = await Item.create(data, {parent: actor});
	 *
	 * @example <caption>Create an Item in a Compendium pack</caption>
	 * const data = [{name: "Special Sword", type: "weapon"}];
	 * const created = await Item.create(data, {pack: "mymodule.mypack"});
	 */
	static create<TDocument extends Document>(
		//this: ConstructorOf<TDocument>,
		data: PreCreate<TDocument['_source']>,
		context?: DocumentModificationContext<TDocument['parent']>
	): Promise<TDocument | undefined>;
	static create<TDocument extends Document>(
		//this: ConstructorOf<TDocument>,
		data: PreCreate<TDocument['_source']>[],
		context?: DocumentModificationContext<TDocument['parent']>
	): Promise<TDocument[]>;
	static create<TDocument extends Document>(
		//this: ConstructorOf<TDocument>,
		data: PreCreate<TDocument['_source']> | PreCreate<TDocument['_source']>[],
		context?: DocumentModificationContext<TDocument['parent']>
	): Promise<TDocument[] | TDocument | undefined>;

	/**
	 * Update one or multiple existing entities using provided input data.
	 * Data may be provided as a single object to update one Document, or as an Array of Objects.
	 * @static
	 *
	 * @param data              A Data object or array of Data. Each element must contain the _id of an existing Document.
	 * @param options           Additional options which customize the update workflow
	 * @param [options.diff]    Difference the provided data against the current to eliminate unnecessary changes.
	 * @param [options.noHook]  Block the dispatch of preUpdate hooks for this operation.
	 *
	 * @return  The updated Document or array of Entities
	 *
	 * @example
	 * const data = {_id: "12ekjf43kj2312ds", name: "New Name"}};
	 * const updated = await Document.update(data); // Updated entity saved to the database
	 *
	 * @example
	 * const data = [{_id: "12ekjf43kj2312ds", name: "New Name 1"}, {_id: "kj549dk48k34jk34", name: "New Name 2"}]};
	 * const updated = await Document.update(data); // Returns an Array of Entities, updated in the database
	 */
	update(data: Record<string, unknown>, options?: DocumentModificationContext<TParent>): Promise<this>;

	/**
                 * Delete the current Document.
                 * @see {Document.delete}

                 * @param context Options which customize the deletion workflow
                 * @return The deleted Document
                 */
	delete(context?: DocumentModificationContext<TParent>): Promise<this | undefined>;

	/* -------------------------------------------- */
	/*  Embedded Operations                         */
	/* -------------------------------------------- */

	/**
	 * A compatibility method that returns the appropriate name of an embedded collection within this Document.
	 * @param name An existing collection name or a document name.
	 * @returns The provided collection name if it exists, the first available collection for the
	 *          document name provided, or null if no appropriate embedded collection could be found.
	 * @example Passing an existing collection name.
	 * ```js
	 * Actor.getCollectionName("items");
	 * // returns "items"
	 * ```
	 *
	 * @example Passing a document name.
	 * ```js
	 * Actor.getCollectionName("Item");
	 * // returns "items"
	 * ```
	 */
	static getCollectionName(name: string): string | null;

	/**
	 * Obtain a reference to the Array of source data within the data object for a certain embedded Document name
	 * @param embeddedName The name of the embedded Document type
	 * @return The Collection instance of embedded Documents of the requested type
	 */
	getEmbeddedCollection(embeddedName: string): EmbeddedCollection<Document<Document>>;

	/**
	 * Get an embedded document by it's id from a named collection in the parent document.
	 * @param embeddedName The name of the embedded Document type
	 * @param id The id of the child document to retrieve
	 * @param [options] Additional options which modify how embedded documents are retrieved
	 * @param [options.strict=false] Throw an Error if the requested id does not exist. See Collection#get
	 * @return The retrieved embedded Document instance, or undefined
	 */
	getEmbeddedDocument(embeddedName: string, id: string, { strict }: { strict: true }): Document;
	getEmbeddedDocument(embeddedName: string, id: string, { strict }: { strict: false }): Document | undefined;
	getEmbeddedDocument(embeddedName: string, id: string, { strict }?: { strict?: boolean }): Document | undefined;

	/**
	 * Create multiple embedded Document instances within this parent Document using provided input data.
	 * @see {@link Document.createDocuments}
	 * @param embeddedName The name of the embedded Document type
	 * @param data An array of data objects used to create multiple documents
	 * @param [context={}] Additional context which customizes the creation workflow
	 * @return An array of created Document instances
	 */
	createEmbeddedDocuments(
		embeddedName: string,
		data: object[],
		context?: DocumentModificationContext<this>
	): Promise<Document[]>;

	/**
                 * Update one or multiple existing entities using provided input data.
                 * Data may be provided as a single object to update one Document, or as an Array of Objects.
                 /**
                 * Update multiple embedded Document instances within a parent Document using provided differential data.
                 * @see {@link Document.updateDocuments}
                 * @param embeddedName               The name of the embedded Document type
                 * @param updates An array of differential data objects, each used to update a single Document
                 * @param [context={}] Additional context which customizes the update workflow
                 * @return An array of updated Document instances
                 */
	updateEmbeddedDocuments(
		embeddedName: string,
		updateData: EmbeddedDocumentUpdateData[],
		context?: DocumentUpdateContext<this>
	): Promise<Document[]>;

	/**
	 * Delete multiple embedded Document instances within a parent Document using provided string ids.
	 * @see {@link Document.deleteDocuments}
	 * @param embeddedName               The name of the embedded Document type
	 * @param ids                      An array of string ids for each Document to be deleted
	 * @param [context={}] Additional context which customizes the deletion workflow
	 * @return An array of deleted Document instances
	 */
	deleteEmbeddedDocuments(
		embeddedName: string,
		dataId: string[],
		context?: DocumentModificationContext<this>
	): Promise<Document<this>[]>;

	/* -------------------------------------------- */
	/*  Flag Operations                             */
	/* -------------------------------------------- */

	/**
	 * Get the value of a "flag" for this document
	 * See the setFlag method for more details on flags
	 *
	 * @param scope The flag scope which namespaces the key
	 * @param key   The flag key
	 * @return The flag value
	 */
	getFlag(scope: string, key: string): unknown;

	/**
	 * Assign a "flag" to this document.
	 * Flags represent key-value type data which can be used to store flexible or arbitrary data required by either
	 * the core software, game systems, or user-created modules.
	 *
	 * Each flag should be set using a scope which provides a namespace for the flag to help prevent collisions.
	 *
	 * Flags set by the core software use the "core" scope.
	 * Flags set by game systems or modules should use the canonical name attribute for the module
	 * Flags set by an individual world should "world" as the scope.
	 *
	 * Flag values can assume almost any data type. Setting a flag value to null will delete that flag.
	 *
	 * @param scope The flag scope which namespaces the key
	 * @param key The flag key
	 * @param value The flag value
	 * @return A Promise resolving to the updated document
	 */
	setFlag(scope: string, key: string, value: unknown): Promise<this>;

	/**
	 * Remove a flag assigned to the Document
	 * @param scope The flag scope which namespaces the key
	 * @param key   The flag key
	 * @return A Promise resolving to the updated Document
	 */
	unsetFlag(scope: string, key: string): Promise<this>;

	/* -------------------------------------------- */
	/*  Event Handlers                              */
	/* -------------------------------------------- */

	/**
	 * Perform preliminary operations before a Document of this type is created.
	 * Pre-creation operations only occur for the client which requested the operation.
	 * Modifications to the pending document before it is persisted should be performed with this.updateSource().
	 * @param data    The initial data object provided to the document creation request
	 * @param options Additional options which modify the creation request
	 * @param user    The User requesting the document creation
	 * @returns A return value of false indicates the creation operation should be cancelled.
	 */
	protected _preCreate(
		data: this['_source'],
		options: DocumentModificationContext<TParent>,
		user: BaseUser
	): Promise<boolean | void>;

	/**
	 * Perform preliminary operations before a Document of this type is updated.
	 * Pre-update operations only occur for the client which requested the operation.
	 * @param changed The differential data that is changed relative to the documents prior values
	 * @param options Additional options which modify the update request
	 * @param user    The User requesting the document update
	 * @returns A return value of false indicates the update operation should be cancelled.
	 */
	protected _preUpdate(
		changed: DeepPartial<this['_source']>,
		options: DocumentUpdateContext<TParent>,
		user: BaseUser
	): Promise<boolean | void>;

	/**
	 * Perform preliminary operations before a Document of this type is deleted.
	 * Pre-delete operations only occur for the client which requested the operation.
	 * @param options Additional options which modify the deletion request
	 * @param user    The User requesting the document deletion
	 * @returns A return value of false indicates the deletion operation should be cancelled.
	 */
	protected _preDelete(options: DocumentModificationContext<TParent>, user: BaseUser): Promise<boolean | void>;

	/**
	 * Perform follow-up operations after a Document of this type is created.
	 * Post-creation operations occur for all clients after the creation is broadcast.
	 * @param data    The initial data object provided to the document creation request
	 * @param options Additional options which modify the creation request
	 */
	protected _onCreate(data: this['_source'], options: DocumentModificationContext<TParent>, userId: string): void;

	/**
	 * Perform follow-up operations after a Document of this type is updated.
	 * Post-update operations occur for all clients after the update is broadcast.
	 * @param changed The differential data that was changed relative to the documents prior values
	 * @param options Additional options which modify the update request
	 * @param userId  The ID of the User requesting the document update
	 */
	protected _onUpdate(
		changed: DeepPartial<this['_source']>,
		options: DocumentUpdateContext<TParent>,
		userId: string
	): void;

	/**
	 * Perform follow-up operations after a Document of this type is deleted.
	 * Post-deletion operations occur for all clients after the deletion is broadcast.
	 * @param options Additional options which modify the deletion request
	 * @param userId The ID of the User requesting the document deletion
	 */
	protected _onDelete(options: DocumentModificationContext<TParent>, userId: string): void;

	/**
	 * Perform follow-up operations when a set of Documents of this type are created.
	 * This is where side effects of creation should be implemented.
	 * Post-creation side effects are performed only for the client which requested the operation.
	 * @param documents The Document instances which were created
	 * @param context   The context for the modification operation
	 */
	protected static _onCreateDocuments(
		documents: Document[],
		context: DocumentModificationContext<Document | null>
	): void;

	/**
	 * Perform follow-up operations when a set of Documents of this type are updated.
	 * This is where side effects of updates should be implemented.
	 * Post-update side effects are performed only for the client which requested the operation.
	 * @param documents The Document instances which were updated
	 * @param context   The context for the modification operation
	 */
	protected static _onUpdateDocuments(
		documents: Document[],
		context: DocumentModificationContext<Document | null>
	): void;

	/**
	 * Perform follow-up operations when a set of Documents of this type are deleted.
	 * This is where side effects of deletion should be implemented.
	 * Post-deletion side effects are performed only for the client which requested the operation.
	 * @param documents The Document instances which were deleted
	 * @param context   The context for the modification operation
	 */
	protected static _onDeleteDocuments(
		documents: Document[],
		context: DocumentModificationContext<Document | null>
	): void;

	/* ---------------------------------------- */
	/*  Serialization and Storage               */
	/* ---------------------------------------- */

	/**
	 * Transform the Document instance into a plain object.
	 * The created object is an independent copy of the original data.
	 * See DocumentData#toObject
	 * @param [source=true] Draw values from the underlying data source rather than transformed values
	 * @returns The extracted primitive object
	 */
	toObject(source?: true): this['_source'];
	toObject(source: false): RawObject<this>;
	toObject(source?: boolean): this['_source'] | RawObject<this>;

	/**
	 * Serializing an Document should simply serialize its inner data, not the entire instance
	 */
	toJSON(): RawObject<this>;
}

type MetadataPermission =
	| keyof typeof CONST.USER_ROLES
	| keyof typeof CONST.USER_PERMISSIONS
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	| ((...args: any[]) => boolean);

export interface DocumentMetadata {
	name: string;
	collection: string;
	indexed: boolean;
	compendiumIndexFields: string[];
	label: string;
	coreTypes: string[] | number[];
	embedded: Record<string, string>;
	permissions: {
		create: MetadataPermission;
		update: MetadataPermission;
		delete: MetadataPermission;
	};
	preserveOnImport: string[];
}

type _Document = Document<_Document | null>;

declare global {
	type PreCreate<T extends SourceFromSchema<DataSchema>> = T extends { name: string; type: string }
		? Omit<DeepPartial<T>, '_id' | 'name' | 'type'> & { _id?: Maybe<string>; name: string; type: T['type'] }
		: DeepPartial<T>;

	type EmbeddedDocumentUpdateData = {
		_id: string;
		[key: string]: unknown;
	};

	interface DocumentRenderOptions extends RenderOptions {
		data?: {
			permission?: boolean;
		};
	}

	type DocumentFlags = Record<string, Record<string, unknown> | undefined>;

	interface DocumentCloneContext extends Omit<DocumentConstructionContext<null>, 'parent'> {
		save?: boolean;
		keepId?: boolean;
	}

	interface DocumentSourceUpdateContext extends Omit<DocumentModificationContext<null>, 'parent'> {
		dryRun?: boolean;
		fallback?: boolean;
		restoreDelta?: boolean;
	}
}
