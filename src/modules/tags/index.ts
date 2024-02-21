import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { ClientError, Transaction } from '@sanity/client'
import type { Asset, HttpError, MyEpic, TagSelectOption, Tag, TagItem } from '@types'
import groq from 'groq'
import { Selector } from 'react-redux'
import { ofType } from 'redux-observable'
import { concat, EMPTY, from, Observable, of } from 'rxjs'
import { bufferTime, catchError, concatMap, delay, filter, mergeMap, startWith, switchMap, take, toArray, withLatestFrom } from 'rxjs/operators'
import { TAG_DOCUMENT_NAME } from '../../constants'
import checkTagName from '../../operators/checkTagName'
import debugThrottle from '../../operators/debugThrottle'
import getTagSelectOptions from '../../utils/getTagSelectOptions'
import { ASSETS_ACTIONS } from '../assets/actions'
import { DIALOG_ACTIONS } from '../dialog/actions'
import type { RootReducerState } from '../types'
import useTypedSelector from '../../hooks/useTypedSelector'
import { assetsActions } from '../assets'

type TagsReducerState = {
  allIds: string[]
  byIds: Record<string, TagItem>
  creating: boolean
  creatingError?: HttpError
  fetchCount: number
  fetching: boolean
  fetchingError?: HttpError
  // totalCount: number
  panelVisible: boolean
  operationSuccess: boolean
  operationFailure: boolean
}

const initialState = {
  allIds: [],
  byIds: {},
  creating: false,
  creatingError: undefined,
  fetchCount: -1,
  fetching: false,
  fetchingError: undefined,
  panelVisible: true,
  operationSuccess: false,
  operationFailure: false
} as TagsReducerState

const ASSET_QUERY = `
  {
    "items": *[_type == "sanity.imageAsset" || _type == "sanity.fileAsset"] {
      _id,
      _type,
      _createdAt,
      _updatedAt,
      alt,
      description,
      extension,
      metadata {
        dimensions,
        exif,
        isOpaque,
      },
      mimeType,
      opt {
        media
      },
      originalFilename,
      size,
      title,
      url,
      tags,
      attribution
    }
  }
`;

const SUCCESS_MESSAGE = "All assets processed successfully.";
const FAILURE_MESSAGE = "Some assets could not be processed.";
const INTERNAL_ERROR_MESSAGE = "Internal error";

const tagsSlice = createSlice({
  name: 'tags',
  initialState,
  extraReducers: builder => {
    builder
      .addCase(DIALOG_ACTIONS.showTagCreate, state => {
        delete state.creatingError
      })
      .addCase(DIALOG_ACTIONS.showTagEdit, (state, action) => {
        const { tagId } = action.payload
        delete state.byIds[tagId].error
      })
      .addMatcher(
        action =>
          [
            ASSETS_ACTIONS.tagsAddComplete.type,
            ASSETS_ACTIONS.tagsAddError.type,
            ASSETS_ACTIONS.tagsRemoveComplete.type,
            ASSETS_ACTIONS.tagsRemoveError.type
          ].includes(action.type),
        (state, action) => {
          const { tag } = action.payload
          state.byIds[tag._id].updating = false
        }
      )
      .addMatcher(
        action =>
          [
            ASSETS_ACTIONS.tagsAddRequest.type, //
            ASSETS_ACTIONS.tagsRemoveRequest.type
          ].includes(action.type),
        (state, action) => {
          const { tag } = action.payload
          state.byIds[tag._id].updating = true
        }
      )

  },
  reducers: {
    createComplete(state, action: PayloadAction<{ assetId?: string; tag: Tag }>) {
      const { tag } = action.payload
      state.creating = false
      if (!state.allIds.includes(tag._id)) {
        state.allIds.push(tag._id)
      }
      state.byIds[tag._id] = {
        _type: 'tag',
        picked: false,
        tag,
        updating: false
      }
    },
    prepareTagOptions(state, action: PayloadAction<{ assetId: string, tags: string[], currentAsset: Asset }>) {
    },
    checkAndCreateTagsStart(state) {
    },
    checkAndCreateTagsSuccess(state, action) {
      state.operationSuccess = true;
      state.operationFailure = false;
    },
    checkAndCreateTagsFailure(state, action) {
      state.operationSuccess = false; // Reset success state on failure
      state.operationFailure = true;
    },
    resetTagsOperationState(state) {
      state.operationSuccess = false;
      state.operationFailure = false;
    },
    createError(state, action: PayloadAction<{ error: HttpError; name: string }>) {
      state.creating = false
      state.creatingError = action.payload.error
    },
    createRequest(state, _action: PayloadAction<{ assetId?: string; name: string }>) {
      state.creating = true
      delete state.creatingError
    },
    deleteComplete(state, action: PayloadAction<{ tagId: string }>) {
      const { tagId } = action.payload
      const deleteIndex = state.allIds.indexOf(tagId)
      if (deleteIndex >= 0) {
        state.allIds.splice(deleteIndex, 1)
      }
      delete state.byIds[tagId]
    },
    deleteError(state, action: PayloadAction<{ error: HttpError; tag: Tag }>) {
      const { error, tag } = action.payload

      const tagId = tag?._id
      state.byIds[tagId].error = error
      state.byIds[tagId].updating = false
    },
    deleteRequest(state, action: PayloadAction<{ tag: Tag }>) {
      const tagId = action.payload?.tag?._id
      state.byIds[tagId].picked = false
      state.byIds[tagId].updating = true

      Object.keys(state.byIds).forEach(key => {
        delete state.byIds[key].error
      })
    },
    fetchComplete(state, action: PayloadAction<{ tags: Tag[] }>) {
      const { tags } = action.payload

      tags?.forEach(tag => {
        state.allIds.push(tag._id)
        state.byIds[tag._id] = {
          _type: 'tag',
          picked: false,
          tag,
          updating: false
        }
      })

      state.fetching = false
      state.fetchCount = tags.length || 0
      delete state.fetchingError
    },
    fetchError(state, action: PayloadAction<{ error: HttpError }>) {
      const { error } = action.payload
      state.fetching = false
      state.fetchingError = error
    },
    fetchRequest: {
      reducer: (state, _action: PayloadAction<{ query: string }>) => {
        state.fetching = true
        delete state.fetchingError
      },
      prepare: () => {
        // Construct query
        const query = groq`
          {
            "items": *[
              _type == "${TAG_DOCUMENT_NAME}"
              && !(_id in path("drafts.**"))
            ] {
              _createdAt,
              _updatedAt,
              _id,
              _rev,
              _type,
              name
            } | order(name.current asc),
          }
        `
        return { payload: { query } }
      }
    },
    // Queue batch tag creation
    listenerCreateQueue(_state, _action: PayloadAction<{ tag: Tag }>) {
      //
    },
    // Apply created tags (via sanity real-time events)
    listenerCreateQueueComplete(state, action: PayloadAction<{ tags: Tag[] }>) {
      const { tags } = action.payload

      tags?.forEach(tag => {
        state.byIds[tag._id] = {
          _type: 'tag',
          picked: false,
          tag,
          updating: false
        }
        if (!state.allIds.includes(tag._id)) {
          state.allIds.push(tag._id)
        }
      })
    },
    // Queue batch tag deletion
    listenerDeleteQueue(_state, _action: PayloadAction<{ tagId: string }>) {
      //
    },
    // Apply deleted tags (via sanity real-time events)
    listenerDeleteQueueComplete(state, action: PayloadAction<{ tagIds: string[] }>) {
      const { tagIds } = action.payload

      tagIds?.forEach(tagId => {
        const deleteIndex = state.allIds.indexOf(tagId)
        if (deleteIndex >= 0) {
          state.allIds.splice(deleteIndex, 1)
        }
        delete state.byIds[tagId]
      })
    },
    // Queue batch tag updates
    listenerUpdateQueue(_state, _action: PayloadAction<{ tag: Tag }>) {
      //
    },
    // Apply updated tags (via sanity real-time events)
    listenerUpdateQueueComplete(state, action: PayloadAction<{ tags: Tag[] }>) {
      const { tags } = action.payload

      tags?.forEach(tag => {
        if (state.byIds[tag._id]) {
          state.byIds[tag._id].tag = tag
        }
      })
    },
    // Set tag panel visibility
    panelVisibleSet(state, action: PayloadAction<{ panelVisible: boolean }>) {
      const { panelVisible } = action.payload
      state.panelVisible = panelVisible
    },
    // Sort all tags by name
    sort(state) {
      state.allIds.sort((a, b) => {
        const tagA = state.byIds[a].tag.name.current
        const tagB = state.byIds[b].tag.name.current

        if (tagA < tagB) {
          return -1
        } else if (tagA > tagB) {
          return 1
        }
        return 0
      })
    },
    updateComplete(state, action: PayloadAction<{ closeDialogId?: string; tag: Tag }>) {
      const { tag } = action.payload
      state.byIds[tag._id].tag = tag
      state.byIds[tag._id].updating = false
    },
    updateError(state, action: PayloadAction<{ tag: Tag; error: HttpError }>) {
      const { error, tag } = action.payload
      const tagId = tag?._id
      state.byIds[tagId].error = error
      state.byIds[tagId].updating = false
    },
    updateRequest(
      state,
      action: PayloadAction<{
        closeDialogId?: string
        formData: Record<string, any>
        tag: Tag
      }>
    ) {
      const { tag } = action.payload
      state.byIds[tag?._id].updating = true
    }
  }
})

// Epics

// On tag create request:
// - async check to see if tag already exists
// - throw if tag already exists
// - otherwise, create new tag
export const tagsCreateEpic: MyEpic = (action$, state$, { client }) =>
  action$.pipe(
    filter(tagsSlice.actions.createRequest.match),
    withLatestFrom(state$),
    mergeMap(([action, state]) => {
      const { assetId, name } = action.payload

      return of(action).pipe(
        debugThrottle(state.debug.badConnection),
        checkTagName(client, name),
        mergeMap(() =>
          client.observable.create({
            _type: TAG_DOCUMENT_NAME,
            name: {
              _type: 'slug',
              current: name
            }
          })
        ),
        mergeMap(result => of(tagsSlice.actions.createComplete({ assetId, tag: result as Tag }))),
        catchError((error: ClientError) =>
          of(
            tagsSlice.actions.createError({
              error: {
                message: error?.message || 'Internal error',
                statusCode: error?.statusCode || 500
              },
              name
            })
          )
        )
      )
    })
  );

  export const checkAndCreateTagsForAssetsEpic: MyEpic = (action$, state$, { client }) =>
  action$.pipe(
    filter(tagsSlice.actions.checkAndCreateTagsStart.match),
    withLatestFrom(state$),
    switchMap(([action, state]) => {
      return client.observable.fetch<{ items: Asset[] }>(ASSET_QUERY).pipe(
        mergeMap(result => {
          const { items } = result;
          const prepareTagOptionsActions$ = from(items).pipe(
            concatMap(asset => {
              if (asset.tags) {
                const params = { assetId: asset._id, tags: asset.tags, currentAsset: asset };
                return of(tagsSlice.actions.prepareTagOptions(params)).pipe(delay(10000));
              }
              return EMPTY;
            }),
          );

          const finalAction$ = from(items).pipe(
            toArray(),
            mergeMap(processedItems => {
              const allOperationsSuccessful = processedItems.length === items.length;
              return of(
                allOperationsSuccessful
                  ? checkAndCreateTagsSuccess({ message: SUCCESS_MESSAGE })
                  : checkAndCreateTagsFailure({ message: FAILURE_MESSAGE })
              );
            })
          );

          return concat(prepareTagOptionsActions$, finalAction$);
        }),
        catchError((error: any) =>
          of(checkAndCreateTagsFailure({
            message: error?.message || INTERNAL_ERROR_MESSAGE,
            statusCode: error?.statusCode || 500
          }))
        )
      );
    })
  );

export const ensureTagsExistEpic: MyEpic = (action$, state$) =>
  action$.pipe(
    filter(tagsSlice.actions.prepareTagOptions.match),
    mergeMap(action => {
      let updatedTagOptions: any[] = [];
      const existingTags = action.payload.currentAsset.opt?.media?.tags || [];
      updatedTagOptions.push(...existingTags);

      return from(action.payload.tags).pipe(
        concatMap(tagName => {
          const asset = action.payload.currentAsset;
          const tagExists = Object.values(state$?.value?.tags?.byIds).some(tag => tag?.tag?.name?.current === tagName);
          const tagIdExistsInAsset = action.payload.currentAsset.opt?.media?.tags?.some(tagRef => {
            const tag = state$.value.tags.byIds[tagRef._ref];
            return tag?.tag?.name?.current === tagName;
          });
          if (!tagExists) {
            return action$.pipe(
              ofType(tagsSlice.actions.createComplete.type),
              take(1),
              mergeMap(createCompleteAction => {
                const newTagRef = createCompleteAction.payload.tag._id;
                updatedTagOptions.push({
                  "_ref": newTagRef,
                  "_type": "reference",
                  "_weak": true
                });
                
                const formData = createFormData(asset, updatedTagOptions);

                return of(assetsActions.updateRequest({ asset, formData }));
              }),
              startWith(tagsActions.createRequest({
                assetId: action.payload.assetId,
                name: tagName as string,
              }))
            );
          } else if (!tagIdExistsInAsset) {
            const newTagRef = Object.entries(state$.value.tags.byIds).find(([tagId, tag]) => tag?.tag?.name?.current === tagName)?.[0];

            if (newTagRef) {
              updatedTagOptions.push({
                "_ref": newTagRef,
                "_type": "reference",
                "_weak": true
              });

              const formData = createFormData(asset, updatedTagOptions);

              return of(assetsActions.updateRequest({ asset, formData }));
            }
          }
          return EMPTY;
        })
      );
    })
  );

// On tag delete request
// - find referenced assets
// - remove tag from referenced assets in a sanity transaction
export const tagsDeleteEpic: MyEpic = (action$, state$, { client }) =>
  action$.pipe(
    filter(tagsSlice.actions.deleteRequest.match),
    withLatestFrom(state$),
    mergeMap(([action, state]) => {
      const { tag } = action.payload
      return of(action).pipe(
        // Optionally throttle
        debugThrottle(state.debug.badConnection),
        // Fetch assets which reference this tag
        mergeMap(() =>
          client.observable.fetch<Asset[]>(
            groq`*[
              _type in ["sanity.fileAsset", "sanity.imageAsset"]
              && references(*[_type == "media.tag" && name.current == $tagName]._id)
            ] {
              _id,
              _rev,
              opt
            }`,
            { tagName: tag.name.current }
          )
        ),
        // Create transaction which remove tag references from all matched assets and delete tag
        mergeMap(assets => {
          const patches = assets.map(asset => ({
            id: asset._id,
            patch: {
              // this will cause the transaction to fail if the document has been modified since it was fetched.
              ifRevisionID: asset._rev,
              unset: [`opt.media.tags[_ref == "${tag._id}"]`]
            }
          }))

          const transaction: Transaction = patches.reduce(
            (tx, patch) => tx.patch(patch.id, patch.patch),
            client.transaction()
          )

          transaction.delete(tag._id)

          return from(transaction.commit())
        }),
        // Dispatch complete action
        mergeMap(() => of(tagsSlice.actions.deleteComplete({ tagId: tag._id }))),
        catchError((error: ClientError) =>
          of(
            tagsSlice.actions.deleteError({
              error: {
                message: error?.message || 'Internal error',
                statusCode: error?.statusCode || 500
              },
              tag
            })
          )
        )
      )
    })
  )

// Async fetch tags
export const tagsFetchEpic: MyEpic = (action$, state$, { client }) =>
  action$.pipe(
    filter(tagsSlice.actions.fetchRequest.match),
    withLatestFrom(state$),
    switchMap(([action, state]) => {
      const { query } = action.payload

      return of(action).pipe(
        // Optionally throttle
        debugThrottle(state.debug.badConnection),
        // Fetch tags
        mergeMap(() =>
          client.observable.fetch<{
            items: Tag[]
          }>(query)
        ),
        // Dispatch complete action
        mergeMap(result => {
          const { items } = result
          return of(tagsSlice.actions.fetchComplete({ tags: items }))
        }),
        catchError((error: ClientError) =>
          of(
            tagsSlice.actions.fetchError({
              error: {
                message: error?.message || 'Internal error',
                statusCode: error?.statusCode || 500
              }
            })
          )
        )
      )
    })
  )

// TODO: merge all buffer epics
// Buffer tag creation via sanity subscriber
export const tagsListenerCreateQueueEpic: MyEpic = action$ =>
  action$.pipe(
    filter(tagsSlice.actions.listenerCreateQueue.match),
    bufferTime(2000),
    filter(actions => actions.length > 0),
    mergeMap(actions => {
      const tags = actions?.map(action => action.payload.tag)
      return of(tagsSlice.actions.listenerCreateQueueComplete({ tags }))
    })
  )

// TODO: merge all buffer epics
// Buffer tag deletion via sanity subscriber
export const tagsListenerDeleteQueueEpic: MyEpic = action$ =>
  action$.pipe(
    filter(tagsSlice.actions.listenerDeleteQueue.match),
    bufferTime(2000),
    filter(actions => actions.length > 0),
    mergeMap(actions => {
      const tagIds = actions?.map(action => action.payload.tagId)
      return of(tagsSlice.actions.listenerDeleteQueueComplete({ tagIds }))
    })
  )

// TODO: merge all buffer epics
// Buffer tag update via sanity subscriber
export const tagsListenerUpdateQueueEpic: MyEpic = action$ =>
  action$.pipe(
    filter(tagsSlice.actions.listenerUpdateQueue.match),
    bufferTime(2000),
    filter(actions => actions.length > 0),
    mergeMap(actions => {
      const tags = actions?.map(action => action.payload.tag)
      return of(tagsSlice.actions.listenerUpdateQueueComplete({ tags }))
    })
  )

// On successful tag creation or updates:
// - Re-sort all tags
export const tagsSortEpic: MyEpic = action$ =>
  action$.pipe(
    ofType(
      tagsSlice.actions.listenerCreateQueueComplete.type,
      tagsSlice.actions.listenerUpdateQueueComplete.type
    ),
    bufferTime(1000),
    filter(actions => actions.length > 0),
    mergeMap(() => of(tagsSlice.actions.sort()))
  )

// On tag update request
// - check if tag name already exists
// - throw if tag already exists
// - otherwise, patch document
export const tagsUpdateEpic: MyEpic = (action$, state$, { client }) =>
  action$.pipe(
    filter(tagsSlice.actions.updateRequest.match),
    withLatestFrom(state$),
    mergeMap(([action, state]) => {
      const { closeDialogId, formData, tag } = action.payload

      return of(action).pipe(
        // Optionally throttle
        debugThrottle(state.debug.badConnection),
        // Check if tag name is available, throw early if not
        checkTagName(client, formData?.name?.current),
        // Patch document (Update tag)
        mergeMap(
          () =>
            from(
              client
                .patch(tag._id)
                .set({ name: { _type: 'slug', current: formData?.name.current } })
                .commit()
            ) as Observable<Tag>
        ),
        // Dispatch complete action
        mergeMap((updatedTag: Tag) => {
          return of(
            tagsSlice.actions.updateComplete({
              closeDialogId,
              tag: updatedTag
            })
          )
        }),
        catchError((error: ClientError) =>
          of(
            tagsSlice.actions.updateError({
              error: {
                message: error?.message || 'Internal error',
                statusCode: error?.statusCode || 500
              },
              tag
            })
          )
        )
      )
    })
  )

// Selectors

const selectTagsByIds = (state: RootReducerState) => state.tags.byIds

const selectTagsAllIds = (state: RootReducerState) => state.tags.allIds

const createFormData = (asset: any, updatedTagOptions: any[]) => ({
  "alt": asset?.alt,
  "description": asset?.description,
  "opt": { "media": { "tags": updatedTagOptions } },
  "originalFilename": asset?.originalFilename,
  "title": asset?.title,
  "attribution": asset?.attribution
});

export const selectTags: Selector<RootReducerState, TagItem[]> = createSelector(
  [selectTagsByIds, selectTagsAllIds],
  (byIds, allIds) => allIds.map(id => byIds[id])
)

export const selectTagById = createSelector(
  [selectTagsByIds, (_state: RootReducerState, tagId: string) => tagId],
  (byIds, tagId) => byIds[tagId]
)

// TODO: use createSelector
// Map tag references to react-select options, skipping over items with no linked tags
export const selectTagSelectOptions =
  (asset?: Asset) =>
    (state: RootReducerState): TagSelectOption[] | null => {
      const tags = asset?.opt?.media?.tags?.reduce((acc: TagItem[], v) => {
        const tagItem = state.tags.byIds[v._ref]
        if (tagItem?.tag) {
          acc.push(tagItem)
        }
        return acc
      }, [])

      if (tags && tags?.length > 0) {
        return getTagSelectOptions(tags)
      }

      return null
    }

export const tagsActions = tagsSlice.actions

export const { checkAndCreateTagsSuccess, checkAndCreateTagsFailure, resetTagsOperationState } = tagsSlice.actions

export default tagsSlice.reducer