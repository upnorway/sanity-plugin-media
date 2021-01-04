import {SelectIcon} from '@sanity/icons'
import {Box, Button, Menu, MenuButton, MenuDivider, MenuItem} from '@sanity/ui'
import {
  SearchFacetInputNumberModifier,
  SearchFacetInputNumberProps,
  SearchFacetOperatorType
} from '@types'
import React, {FC} from 'react'
import {useDispatch} from 'react-redux'

import {SEARCH_FACET_OPERATORS} from '../../constants'
import {assetsSearchFacetsUpdate} from '../../modules/assets'
import SearchFacet from '../SearchFacet'
import TextInputNumber from '../TextInputNumber'

type Props = {
  facet: SearchFacetInputNumberProps
}

// null values are treated as menu dividers
const OPERATOR_TYPES: (SearchFacetOperatorType | null)[] = [
  'greaterThan',
  'greaterThanOrEqualTo',
  'lessThan',
  'lessThanOrEqualTo',
  null,
  'equalTo'
]

const SearchFacetNumber: FC<Props> = (props: Props) => {
  const {facet} = props

  // Redux
  const dispatch = useDispatch()

  const modifiers = facet?.options?.modifiers
  const selectedModifier = facet?.modifier
    ? modifiers?.find(modifier => modifier.name === facet?.modifier)
    : modifiers?.[0]

  const handleOperatorItemClick = (operatorType: SearchFacetOperatorType) => {
    dispatch(
      assetsSearchFacetsUpdate({
        ...facet,
        operatorType
      })
    )
  }

  const handleModifierClick = (modifier: SearchFacetInputNumberModifier) => {
    dispatch(
      assetsSearchFacetsUpdate({
        ...facet,
        modifier: modifier.name
      })
    )
  }

  const handleValueChange = (value: number) => {
    dispatch(
      assetsSearchFacetsUpdate({
        ...facet,
        value
      })
    )
  }

  const selectedOperatorType: SearchFacetOperatorType = facet.operatorType ?? 'greaterThan'

  return (
    <SearchFacet facet={facet}>
      {/* Comparison operators */}
      <MenuButton
        button={
          <Button
            fontSize={1}
            iconRight={SelectIcon}
            padding={2} //
            text={SEARCH_FACET_OPERATORS[selectedOperatorType].label}
          />
        }
        id="operators"
        menu={
          <Menu>
            {OPERATOR_TYPES.map((operatorType, index) => {
              if (operatorType) {
                return (
                  <MenuItem
                    disabled={operatorType === selectedOperatorType}
                    key={operatorType}
                    onClick={() => handleOperatorItemClick(operatorType)}
                    text={SEARCH_FACET_OPERATORS[operatorType].label}
                  />
                )
              }

              return <MenuDivider key={index} />
            })}
          </Menu>
        }
      />

      {/* Value */}
      <Box marginX={1} style={{maxWidth: '50px'}}>
        <TextInputNumber
          fontSize={1}
          onValueChange={handleValueChange}
          padding={2}
          radius={2}
          width={2}
          value={facet?.value}
        />
      </Box>

      {/* Modifiers */}
      {modifiers && (
        <MenuButton
          button={
            <Button
              fontSize={1}
              iconRight={SelectIcon}
              padding={2} //
              text={selectedModifier?.title}
              tone="primary"
            />
          }
          id="modifier"
          menu={
            <Menu>
              {modifiers.map(modifier => (
                <MenuItem
                  disabled={modifier.name === facet.modifier}
                  key={modifier.name}
                  onClick={() => handleModifierClick(modifier)}
                  text={modifier.title}
                />
              ))}
            </Menu>
          }
        />
      )}
    </SearchFacet>
  )
}

export default SearchFacetNumber
