import {AddIcon} from '@sanity/icons'
import {Button, Flex, Menu, MenuButton, MenuDivider, MenuGroup, MenuItem} from '@sanity/ui'
import {SearchFacetDivider, SearchFacetGroup, SearchFacetInputProps} from '@types'
import React, { useEffect, useState } from 'react'
import {useDispatch} from 'react-redux'
import {FACETS} from '../../constants'
import {usePortalPopoverProps} from '../../hooks/usePortalPopoverProps'
import useTypedSelector from '../../hooks/useTypedSelector'
import {searchActions} from '../../modules/search'
import { assetsActions } from '../../modules/assets'
import { tagsActions } from '../../modules/tags'

const SearchFacetsControl = () => {
  // Redux
  const dispatch = useDispatch()
  const assetTypes = useTypedSelector(state => state.assets.assetTypes)
  const searchFacets = useTypedSelector(state => state.search.facets)
  const selectedDocument = useTypedSelector(state => state.selected.document)

  const [isLoading, setIsLoading] = useState(false);
  // Assuming you have these selectors to get the operation state
  const isOperationSuccess = useTypedSelector(state => state.tags.isOperationSuccess);
  const isOperationFailure = useTypedSelector(state => state.tags.isOperationFailure);

  const LOADING_TEXT = 'Migrating...Please wait';
  const DEFAULT_TEXT = 'Check & Migrate Old Tags';
  const DEFAULT_ICON = AddIcon;
  const FONT_SIZE = 1;
  const MODE = "bleed";
  const SPACE = 2;
  const TONE = "primary";

  const popoverProps = usePortalPopoverProps()

  const isTool = !selectedDocument

  const handleCheckCreateTagsClick = () => {
    setIsLoading(true);
    dispatch(tagsActions.checkAndCreateTagsStart());
  };

  // React to the completion of the operation
  useEffect(() => {
    if (isOperationSuccess || isOperationFailure) {
      setIsLoading(false);
      // Optionally, dispatch an action to reset the operation state here
    }
  }, [isOperationSuccess, isOperationFailure, dispatch]);

  const filteredFacets = FACETS
    // Filter facets based on current context, whether it's invoked as a tool, or via selection through via custom asset source.
    .filter(facet => {
      if (facet.type === 'group' || facet.type === 'divider') {
        return true
      }

      if (isTool) {
        return !facet?.selectOnly
      }

      const matchingAssetTypes = facet.assetTypes.filter(assetType =>
        assetTypes.includes(assetType)
      )
      return matchingAssetTypes.length > 0
    })
    // Remove adjacent and leading / trailing dividers
    .filter((facet, index, facets) => {
      const previousFacet = facets[index - 1]
      // Ignore leading + trailing dividers
      if (facet.type === 'divider' && (index === 0 || index === facets.length - 1)) {
        return false
      }
      // Ignore adjacent dividers
      if (facet.type === 'divider' && previousFacet?.type === 'divider') {
        return false
      }
      return true
    })

  const hasSearchFacets = filteredFacets.length > 0

  const renderMenuFacets = (
    facets: (SearchFacetDivider | SearchFacetGroup | SearchFacetInputProps)[],
    level: number = 0
  ) => {
    return (
      <>
        {facets?.map((facet, index) => {
          if (facet.type === 'divider') {
            return <MenuDivider key={index} />
          }

          // Recursively render menu facets
          if (facet.type === 'group') {
            return (
              <MenuGroup key={`group-${level}-${index}`} text={facet.title} title={facet.title}>
                {renderMenuFacets(facet.facets, level + 1)}
              </MenuGroup>
            )
          }

          if (facet) {
            const disabled = !facet.operatorTypes && !!searchFacets.find(v => v.name === facet.name)

            return (
              <MenuItem
                disabled={disabled}
                fontSize={1}
                key={facet.name}
                onClick={() => dispatch(searchActions.facetsAdd({facet}))}
                padding={2}
                text={facet.title}
              />
            )
          }

          return null
        })}
      </>
    )
  }

  return (
    <Flex>
      {/* Add filter button */}
      <MenuButton
        button={
          <Button
            disabled={!hasSearchFacets}
            fontSize={1}
            icon={AddIcon}
            mode="bleed"
            space={2}
            text="Add filter"
            tone="primary"
          />
        }
        id="facets"
        menu={<Menu>{renderMenuFacets(filteredFacets)}</Menu>}
        popover={{
          ...popoverProps,
          placement: 'right-start'
        }}
      />

      {/* Clear facets button */}
      {searchFacets.length > 0 && (
        <Button
          fontSize={1}
          mode="bleed"
          onClick={() => dispatch(searchActions.facetsClear())}
          text="Clear"
        />
      )}

      <Button
        onClick={handleCheckCreateTagsClick}
        text={isLoading ? LOADING_TEXT : DEFAULT_TEXT}
        icon={isLoading ? null : DEFAULT_ICON} // Adjust icon based on your preference for loading state
        disabled={isLoading} // Disable button when operation is in progress
        fontSize={FONT_SIZE}
        mode={MODE}
        space={SPACE}
        tone={TONE}
      />
    </Flex>
  )
}

export default SearchFacetsControl
